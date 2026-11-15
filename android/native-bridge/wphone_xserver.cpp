#include "wphone_xserver.h"

#include <android/log.h>
#include <algorithm>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cstring>
#include <fcntl.h>
#include <mutex>
#include <poll.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <thread>
#include <unistd.h>
#include <unordered_map>
#include <vector>

#define XLOG_TAG "WPhoneXServer"
#define XLOGI(...) __android_log_print(ANDROID_LOG_INFO, XLOG_TAG, __VA_ARGS__)
#define XLOGE(...) __android_log_print(ANDROID_LOG_ERROR, XLOG_TAG, __VA_ARGS__)

namespace wphone {

namespace {

constexpr uint32_t ROOT_WINDOW_ID = 0x00000100u;
constexpr uint32_t DEFAULT_COLORMAP_ID = 0x00000020u;
constexpr uint32_t VISUAL_24_ID = 0x00000021u;
constexpr uint32_t VISUAL_32_ID = 0x00000022u;

struct XDrawable {
    uint32_t id = 0;
    bool isWindow = false;
    uint32_t parentId = 0;
    int32_t x = 0;
    int32_t y = 0;
    uint16_t width = 1;
    uint16_t height = 1;
    uint8_t depth = 24;
    bool mapped = false;
    bool overrideRedirect = false;
    uint32_t bgPixel = 0x0F172Au;
    uint32_t borderPixel = 0x334155u;
    uint16_t borderWidth = 0;
    uint32_t eventMask = 0;
    std::vector<uint32_t> children;
    std::vector<uint32_t> pixels;  // RGBA/XRGB 0x00RRGGBB or 0xAARRGGBB
};

struct XGC {
    uint32_t id = 0;
    uint32_t fgPixel = 0xFFFFFFu;
    uint32_t bgPixel = 0x000000u;
    uint8_t function = 3;  // GXcopy
};

struct XProp {
    uint32_t typeAtom = 0;
    uint8_t format = 8;
    std::vector<uint8_t> data;
};

struct XClient {
    int fd = -1;
    bool littleEndian = true;
    bool handshakeDone = false;
    uint16_t seq = 0;
    uint32_t idBase = 0;
    uint32_t idMask = 0x001FFFFFu;
    bool bigRequestsEnabled = false;
    std::vector<uint8_t> rxBuf;
};

std::mutex g_mutex;
std::atomic<bool> g_running{false};
std::atomic<bool> g_dirty{false};
std::atomic<int> g_clientCount{0};
std::atomic<int> g_fps{0};
std::atomic<int> g_frameCounter{0};
auto g_lastFpsTick = std::chrono::steady_clock::now();

int g_listenFd = -1;
std::string g_socketPath;
int g_fbWidth = 1280;
int g_fbHeight = 720;
ANativeWindow* g_window = nullptr;
std::thread g_serverThread;
std::thread g_renderThread;

std::vector<uint32_t> g_backbuffer;
int g_cursorX = 640;
int g_cursorY = 360;
uint32_t g_focusWindow = ROOT_WINDOW_ID;
uint32_t g_pointerGrabWindow = 0;

std::unordered_map<uint32_t, XDrawable> g_drawables;
std::unordered_map<uint32_t, XGC> g_gcs;
std::unordered_map<uint32_t, std::unordered_map<uint32_t, XProp>> g_props;
std::unordered_map<uint32_t, uint32_t> g_selectionOwners;
std::unordered_map<std::string, uint32_t> g_atomByName;
std::unordered_map<uint32_t, std::string> g_atomById;
uint32_t g_nextAtomId = 100;
std::vector<XClient> g_clients;

uint16_t read16(const uint8_t* p, bool le) {
    return le ? (uint16_t(p[0]) | (uint16_t(p[1]) << 8))
              : ((uint16_t(p[0]) << 8) | uint16_t(p[1]));
}

int16_t readS16(const uint8_t* p, bool le) {
    return static_cast<int16_t>(read16(p, le));
}

uint32_t read32(const uint8_t* p, bool le) {
    return le ? (uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24))
              : ((uint32_t(p[0]) << 24) | (uint32_t(p[1]) << 16) | (uint32_t(p[2]) << 8) | uint32_t(p[3]));
}

void write16(uint8_t* p, uint16_t v, bool le) {
    if (le) {
        p[0] = v & 0xFF;
        p[1] = (v >> 8) & 0xFF;
    } else {
        p[0] = (v >> 8) & 0xFF;
        p[1] = v & 0xFF;
    }
}

void write32(uint8_t* p, uint32_t v, bool le) {
    if (le) {
        p[0] = v & 0xFF;
        p[1] = (v >> 8) & 0xFF;
        p[2] = (v >> 16) & 0xFF;
        p[3] = (v >> 24) & 0xFF;
    } else {
        p[0] = (v >> 24) & 0xFF;
        p[1] = (v >> 16) & 0xFF;
        p[2] = (v >> 8) & 0xFF;
        p[3] = v & 0xFF;
    }
}

bool sendAll(int fd, const void* data, size_t len) {
    const uint8_t* ptr = static_cast<const uint8_t*>(data);
    size_t sent = 0;
    while (sent < len) {
        ssize_t n = send(fd, ptr + sent, len - sent, MSG_NOSIGNAL);
        if (n < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                struct pollfd pfd{fd, POLLOUT, 0};
                if (poll(&pfd, 1, 250) <= 0) return false;
                continue;
            }
            return false;
        }
        sent += static_cast<size_t>(n);
    }
    return true;
}

void seedDefaultAtoms() {
    g_atomByName.clear();
    g_atomById.clear();
    const char* predefined[] = {
        nullptr,
        "PRIMARY", "SECONDARY", "ARC", "ATOM", "BITMAP", "CARDINAL", "COLORMAP", "CURSOR",
        "CUT_BUFFER0", "CUT_BUFFER1", "CUT_BUFFER2", "CUT_BUFFER3", "CUT_BUFFER4",
        "CUT_BUFFER5", "CUT_BUFFER6", "CUT_BUFFER7", "DRAWABLE", "FONT", "INTEGER",
        "PIXMAP", "POINT", "RECTANGLE", "RESOURCE_MANAGER", "RGB_COLOR_MAP",
        "RGB_BEST_MAP", "RGB_BLUE_MAP", "RGB_DEFAULT_MAP", "RGB_GRAY_MAP",
        "RGB_GREEN_MAP", "RGB_RED_MAP", "STRING", "VISUALID", "WINDOW", "WM_COMMAND",
        "WM_HINTS", "WM_CLIENT_MACHINE", "WM_ICON_NAME", "WM_ICON_SIZE", "WM_NAME",
        "WM_NORMAL_HINTS", "WM_SIZE_HINTS", "WM_ZOOM_HINTS", "MIN_SPACE", "NORM_SPACE",
        "MAX_SPACE", "END_SPACE", "SUPERSCRIPT_X", "SUPERSCRIPT_Y", "SUBSCRIPT_X",
        "SUBSCRIPT_Y", "UNDERLINE_POSITION", "UNDERLINE_THICKNESS", "STRIKEOUT_ASCENT",
        "STRIKEOUT_DESCENT", "ITALIC_ANGLE", "X_HEIGHT", "QUAD_WIDTH", "WEIGHT",
        "POINT_SIZE", "RESOLUTION", "COPYRIGHT", "NOTICE", "FONT_NAME", "FAMILY_NAME",
        "FULL_NAME", "CAP_HEIGHT", "WM_CLASS", "WM_TRANSIENT_FOR"
    };
    for (uint32_t i = 1; i < sizeof(predefined) / sizeof(predefined[0]); ++i) {
        g_atomByName[predefined[i]] = i;
        g_atomById[i] = predefined[i];
    }
    g_nextAtomId = 100;
}

uint32_t internAtom(const std::string& name, bool onlyIfExists) {
    auto it = g_atomByName.find(name);
    if (it != g_atomByName.end()) return it->second;
    if (onlyIfExists) return 0;
    uint32_t id = g_nextAtomId++;
    g_atomByName[name] = id;
    g_atomById[id] = name;
    return id;
}

void resetWorldLocked() {
    g_drawables.clear();
    g_gcs.clear();
    g_props.clear();
    g_selectionOwners.clear();
    seedDefaultAtoms();

    XDrawable root;
    root.id = ROOT_WINDOW_ID;
    root.isWindow = true;
    root.width = static_cast<uint16_t>(g_fbWidth);
    root.height = static_cast<uint16_t>(g_fbHeight);
    root.depth = 24;
    root.mapped = true;
    root.bgPixel = 0x0B1120u;
    root.pixels.assign(static_cast<size_t>(g_fbWidth) * g_fbHeight, 0x0B1120u);
    g_drawables[ROOT_WINDOW_ID] = std::move(root);
    g_focusWindow = ROOT_WINDOW_ID;
    g_pointerGrabWindow = 0;
    g_backbuffer.assign(static_cast<size_t>(g_fbWidth) * g_fbHeight, 0x0B1120u);
    g_dirty.store(true);
}

inline uint32_t toRgbxPixel(uint32_t xrgb) {
    const uint8_t r = (xrgb >> 16) & 0xFF;
    const uint8_t g = (xrgb >> 8) & 0xFF;
    const uint8_t b = xrgb & 0xFF;
    // ANativeWindow WINDOW_FORMAT_RGBX_8888 stores bytes R, G, B, X in memory (LE uint32: 0xFFBBGGRR)
    return 0xFF000000u | (uint32_t(b) << 16) | (uint32_t(g) << 8) | uint32_t(r);
}

void compositeRecursive(uint32_t winId, int32_t absX, int32_t absY) {
    auto it = g_drawables.find(winId);
    if (it == g_drawables.end()) return;
    const XDrawable& d = it->second;
    if (!d.isWindow || !d.mapped) return;

    const int32_t startX = std::max(0, absX);
    const int32_t startY = std::max(0, absY);
    const int32_t endX = std::min(g_fbWidth, absX + static_cast<int32_t>(d.width));
    const int32_t endY = std::min(g_fbHeight, absY + static_cast<int32_t>(d.height));

    if (!d.pixels.empty() && endX > startX && endY > startY) {
        for (int32_t py = startY; py < endY; ++py) {
            const int32_t srcY = py - absY;
            const size_t dstRow = static_cast<size_t>(py) * g_fbWidth;
            const size_t srcRow = static_cast<size_t>(srcY) * d.width;
            for (int32_t px = startX; px < endX; ++px) {
                const int32_t srcX = px - absX;
                g_backbuffer[dstRow + px] = toRgbxPixel(d.pixels[srcRow + srcX]);
            }
        }
    }

    for (uint32_t childId : d.children) {
        auto cit = g_drawables.find(childId);
        if (cit != g_drawables.end()) {
            compositeRecursive(childId, absX + cit->second.x, absY + cit->second.y);
        }
    }
}

void drawCursorOverlay() {
    const int cx = std::clamp(g_cursorX, 0, g_fbWidth - 1);
    const int cy = std::clamp(g_cursorY, 0, g_fbHeight - 1);
    // Crisp high-visibility arrow pointer (10px)
    for (int dy = 0; dy < 14; ++dy) {
        for (int dx = 0; dx <= dy && dx < 10; ++dx) {
            const int px = cx + dx;
            const int py = cy + dy;
            if (px >= 0 && px < g_fbWidth && py >= 0 && py < g_fbHeight) {
                const bool edge = (dx == 0 || dx == dy || dy == 13);
                g_backbuffer[static_cast<size_t>(py) * g_fbWidth + px] =
                    edge ? 0xFF0F172Au : 0xFFFFFFFFu;
            }
        }
    }
}

void presentFrameIfDirty() {
    if (!g_dirty.exchange(false)) return;
    ANativeWindow* win = nullptr;
    int w = 0, h = 0;
    std::vector<uint32_t> frameCopy;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        win = g_window;
        if (!win) return;
        w = g_fbWidth;
        h = g_fbHeight;
        std::fill(g_backbuffer.begin(), g_backbuffer.end(), toRgbxPixel(0x0B1120u));
        compositeRecursive(ROOT_WINDOW_ID, 0, 0);
        drawCursorOverlay();
        frameCopy = g_backbuffer;
    }

    ANativeWindow_Buffer buffer;
    if (ANativeWindow_lock(win, &buffer, nullptr) == 0) {
        const int copyW = std::min(w, buffer.width);
        const int copyH = std::min(h, buffer.height);
        uint8_t* dst = static_cast<uint8_t*>(buffer.bits);
        for (int y = 0; y < copyH; ++y) {
            std::memcpy(
                dst + static_cast<size_t>(y) * buffer.stride * 4,
                frameCopy.data() + static_cast<size_t>(y) * w,
                static_cast<size_t>(copyW) * 4
            );
        }
        ANativeWindow_unlockAndPost(win);
        g_frameCounter.fetch_add(1);
        auto now = std::chrono::steady_clock::now();
        auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - g_lastFpsTick).count();
        if (elapsedMs >= 1000) {
            const int frames = g_frameCounter.exchange(0);
            g_fps.store(static_cast<int>((frames * 1000LL) / std::max<long long>(1, elapsedMs)));
            g_lastFpsTick = now;
        }
    }
}

uint32_t findWindowAt(uint32_t winId, int32_t x, int32_t y, int32_t absX, int32_t absY, int32_t& outRelX, int32_t& outRelY) {
    auto it = g_drawables.find(winId);
    if (it == g_drawables.end() || !it->second.mapped) return 0;
    const XDrawable& d = it->second;
    if (x < absX || y < absY || x >= absX + d.width || y >= absY + d.height) {
        return 0;
    }
    for (auto rit = d.children.rbegin(); rit != d.children.rend(); ++rit) {
        auto cit = g_drawables.find(*rit);
        if (cit != g_drawables.end()) {
            uint32_t hit = findWindowAt(*rit, x, y, absX + cit->second.x, absY + cit->second.y, outRelX, outRelY);
            if (hit != 0) return hit;
        }
    }
    outRelX = x - absX;
    outRelY = y - absY;
    return winId;
}

void sendXEventToInterestedClients(uint32_t targetWin, uint32_t maskNeeded, const uint8_t ev[32]) {
    auto dit = g_drawables.find(targetWin);
    if (dit == g_drawables.end()) return;
    if (maskNeeded != 0 && (dit->second.eventMask & maskNeeded) == 0 && targetWin != ROOT_WINDOW_ID) {
        // Bubble up to parent if child doesn't select it
        if (dit->second.parentId != 0) {
            sendXEventToInterestedClients(dit->second.parentId, maskNeeded, ev);
            return;
        }
    }
    for (auto& c : g_clients) {
        if (!c.handshakeDone || c.fd < 0) continue;
        uint8_t packet[32];
        std::memcpy(packet, ev, 32);
        write16(packet + 2, c.seq, c.littleEndian);
        sendAll(c.fd, packet, 32);
    }
}

bool sendSetupReply(XClient& client) {
    // Standard X11 Connection Setup Success Packet
    const std::string vendor = "WPhone-XServer";
    const size_t vendorPad = (4 - (vendor.size() % 4)) % 4;
    const size_t vendorPaddedLen = vendor.size() + vendorPad;
    // 2 pixmap formats (depth 24 + depth 32): 2 * 8 = 16 bytes
    // 1 screen (40 bytes) + 2 depths:
    //   depth 24 header (8) + 1 visual (24) = 32
    //   depth 32 header (8) + 1 visual (24) = 32
    const size_t extraBytes = 32 + vendorPaddedLen + 16 + 40 + 32 + 32;
    const uint16_t extraWords = static_cast<uint16_t>(extraBytes / 4);
    std::vector<uint8_t> out(8 + extraBytes, 0);

    const bool le = client.littleEndian;
    out[0] = 1;  // Success
    write16(&out[2], 11, le);
    write16(&out[4], 0, le);
    write16(&out[6], extraWords, le);

    size_t p = 8;
    write32(&out[p + 0], 11000000u, le);  // release-number
    write32(&out[p + 4], client.idBase, le);
    write32(&out[p + 8], client.idMask, le);
    write32(&out[p + 12], 0, le);           // motion-buffer-size
    write16(&out[p + 16], static_cast<uint16_t>(vendor.size()), le);
    write16(&out[p + 18], 65535, le);       // max-request-length
    out[p + 20] = 1;                        // roots count
    out[p + 21] = 2;                        // pixmap formats count
    out[p + 22] = le ? 0 : 1;               // image-byte-order
    out[p + 23] = le ? 0 : 1;               // bitmap-format-bit-order
    out[p + 24] = 32;                       // bitmap-format-scanline-unit
    out[p + 25] = 32;                       // bitmap-format-scanline-pad
    out[p + 26] = 8;                        // min-keycode
    out[p + 27] = 255;                      // max-keycode
    p += 32;

    std::memcpy(&out[p], vendor.data(), vendor.size());
    p += vendorPaddedLen;

    // Format 1: depth 24, bpp 32, scanline-pad 32
    out[p + 0] = 24; out[p + 1] = 32; out[p + 2] = 32;
    p += 8;
    // Format 2: depth 32, bpp 32, scanline-pad 32
    out[p + 0] = 32; out[p + 1] = 32; out[p + 2] = 32;
    p += 8;

    // Screen
    write32(&out[p + 0], ROOT_WINDOW_ID, le);
    write32(&out[p + 4], DEFAULT_COLORMAP_ID, le);
    write32(&out[p + 8], 0x00FFFFFFu, le);
    write32(&out[p + 12], 0x00000000u, le);
    write32(&out[p + 16], 0, le);
    write16(&out[p + 20], static_cast<uint16_t>(g_fbWidth), le);
    write16(&out[p + 22], static_cast<uint16_t>(g_fbHeight), le);
    write16(&out[p + 24], static_cast<uint16_t>((g_fbWidth * 254) / 960), le);
    write16(&out[p + 26], static_cast<uint16_t>((g_fbHeight * 254) / 960), le);
    write16(&out[p + 28], 1, le);
    write16(&out[p + 30], 1, le);
    write32(&out[p + 32], VISUAL_24_ID, le);
    out[p + 36] = 0;
    out[p + 37] = 0;
    out[p + 38] = 24;  // root-depth
    out[p + 39] = 2;   // allowed-depths count
    p += 40;

    // Depth 24 + Visual
    out[p + 0] = 24;
    write16(&out[p + 2], 1, le);
    p += 8;
    write32(&out[p + 0], VISUAL_24_ID, le);
    out[p + 4] = 4;   // TrueColor
    out[p + 5] = 8;   // bits-per-rgb
    write16(&out[p + 6], 256, le);
    write32(&out[p + 8], 0x00FF0000u, le);
    write32(&out[p + 12], 0x0000FF00u, le);
    write32(&out[p + 16], 0x000000FFu, le);
    p += 24;

    // Depth 32 + Visual
    out[p + 0] = 32;
    write16(&out[p + 2], 1, le);
    p += 8;
    write32(&out[p + 0], VISUAL_32_ID, le);
    out[p + 4] = 4;
    out[p + 5] = 8;
    write16(&out[p + 6], 256, le);
    write32(&out[p + 8], 0x00FF0000u, le);
    write32(&out[p + 12], 0x0000FF00u, le);
    write32(&out[p + 16], 0x000000FFu, le);

    return sendAll(client.fd, out.data(), out.size());
}

void sendError(XClient& c, uint8_t code, uint32_t badResource, uint16_t minorOp, uint8_t majorOp) {
    uint8_t err[32]{};
    err[0] = 0;
    err[1] = code;
    write16(err + 2, c.seq, c.littleEndian);
    write32(err + 4, badResource, c.littleEndian);
    write16(err + 8, minorOp, c.littleEndian);
    err[10] = majorOp;
    sendAll(c.fd, err, 32);
}

void sendExpose(XClient& c, uint32_t winId, uint16_t w, uint16_t h) {
    uint8_t ev[32]{};
    ev[0] = 12;  // Expose
    write16(ev + 2, c.seq, c.littleEndian);
    write32(ev + 4, winId, c.littleEndian);
    write16(ev + 8, 0, c.littleEndian);
    write16(ev + 10, 0, c.littleEndian);
    write16(ev + 12, w, c.littleEndian);
    write16(ev + 14, h, c.littleEndian);
    write16(ev + 16, 0, c.littleEndian);
    sendAll(c.fd, ev, 32);
}

void handleRequest(XClient& c, const uint8_t* req, size_t len) {
    if (len < 4) return;
    c.seq++;
    const uint8_t op = req[0];
    const uint8_t dataByte = req[1];
    const bool le = c.littleEndian;

    switch (op) {
        case 1: {  // CreateWindow
            if (len < 32) break;
            XDrawable w;
            w.depth = dataByte == 0 ? 24 : dataByte;
            w.id = read32(req + 4, le);
            w.parentId = read32(req + 8, le);
            w.x = readS16(req + 12, le);
            w.y = readS16(req + 14, le);
            w.width = std::max<uint16_t>(1, read16(req + 16, le));
            w.height = std::max<uint16_t>(1, read16(req + 18, le));
            w.borderWidth = read16(req + 20, le);
            w.isWindow = true;
            w.bgPixel = 0x1E293Bu;
            const uint32_t valueMask = read32(req + 28, le);
            size_t off = 32;
            for (int bit = 0; bit < 15 && off + 4 <= len; ++bit) {
                if (valueMask & (1u << bit)) {
                    uint32_t v = read32(req + off, le);
                    if (bit == 1) w.bgPixel = v;
                    if (bit == 9) w.overrideRedirect = (v & 1u) != 0;
                    if (bit == 11) w.eventMask = v;
                    off += 4;
                }
            }
            w.pixels.assign(static_cast<size_t>(w.width) * w.height, w.bgPixel);
            auto pit = g_drawables.find(w.parentId);
            if (pit != g_drawables.end()) {
                pit->second.children.push_back(w.id);
            }
            g_drawables[w.id] = std::move(w);
            break;
        }
        case 2: {  // ChangeWindowAttributes
            if (len < 12) break;
            uint32_t wid = read32(req + 4, le);
            uint32_t valueMask = read32(req + 8, le);
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                size_t off = 12;
                for (int bit = 0; bit < 15 && off + 4 <= len; ++bit) {
                    if (valueMask & (1u << bit)) {
                        uint32_t v = read32(req + off, le);
                        if (bit == 1) it->second.bgPixel = v;
                        if (bit == 9) it->second.overrideRedirect = (v & 1u) != 0;
                        if (bit == 11) it->second.eventMask = v;
                        off += 4;
                    }
                }
            }
            break;
        }
        case 3: {  // GetWindowAttributes
            uint32_t wid = read32(req + 4, le);
            auto it = g_drawables.find(wid);
            if (it == g_drawables.end()) {
                sendError(c, 3, wid, 0, op);
                break;
            }
            uint8_t rep[44]{};
            rep[0] = 1;
            rep[1] = 2;  // backing-store Always
            write16(rep + 2, c.seq, le);
            write32(rep + 4, 3, le);
            write32(rep + 8, it->second.depth == 32 ? VISUAL_32_ID : VISUAL_24_ID, le);
            write16(rep + 12, 1, le);  // InputOutput
            rep[14] = 1;
            rep[15] = 1;
            write32(rep + 24, DEFAULT_COLORMAP_ID, le);
            rep[28] = 1;  // map-installed
            rep[29] = it->second.mapped ? 2 : 0;
            rep[30] = it->second.overrideRedirect ? 1 : 0;
            write32(rep + 36, it->second.eventMask, le);
            sendAll(c.fd, rep, 44);
            break;
        }
        case 4: {  // DestroyWindow
            uint32_t wid = read32(req + 4, le);
            if (wid == ROOT_WINDOW_ID) break;
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                auto pit = g_drawables.find(it->second.parentId);
                if (pit != g_drawables.end()) {
                    auto& ch = pit->second.children;
                    ch.erase(std::remove(ch.begin(), ch.end(), wid), ch.end());
                }
                g_drawables.erase(it);
                g_props.erase(wid);
                g_dirty.store(true);
            }
            break;
        }
        case 8: {  // MapWindow
            uint32_t wid = read32(req + 4, le);
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                it->second.mapped = true;
                g_focusWindow = wid;
                uint8_t mapNotify[32]{};
                mapNotify[0] = 19;  // MapNotify
                write16(mapNotify + 2, c.seq, le);
                write32(mapNotify + 4, it->second.parentId, le);
                write32(mapNotify + 8, wid, le);
                mapNotify[12] = it->second.overrideRedirect ? 1 : 0;
                sendAll(c.fd, mapNotify, 32);
                sendExpose(c, wid, it->second.width, it->second.height);
                g_dirty.store(true);
            }
            break;
        }
        case 10: {  // UnmapWindow
            uint32_t wid = read32(req + 4, le);
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                it->second.mapped = false;
                g_dirty.store(true);
            }
            break;
        }
        case 12: {  // ConfigureWindow
            if (len < 12) break;
            uint32_t wid = read32(req + 4, le);
            uint16_t mask = read16(req + 8, le);
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                uint16_t oldW = it->second.width;
                uint16_t oldH = it->second.height;
                size_t off = 12;
                if ((mask & 0x01) && off + 4 <= len) { it->second.x = readS16(req + off, le); off += 4; }
                if ((mask & 0x02) && off + 4 <= len) { it->second.y = readS16(req + off, le); off += 4; }
                if ((mask & 0x04) && off + 4 <= len) { it->second.width = std::max<uint16_t>(1, read16(req + off, le)); off += 4; }
                if ((mask & 0x08) && off + 4 <= len) { it->second.height = std::max<uint16_t>(1, read16(req + off, le)); off += 4; }
                if ((mask & 0x10) && off + 4 <= len) { it->second.borderWidth = read16(req + off, le); off += 4; }
                if ((mask & 0x20) && off + 4 <= len) { off += 4; }
                if ((mask & 0x40) && off + 4 <= len) {
                    uint32_t stackMode = read32(req + off, le);
                    auto pit = g_drawables.find(it->second.parentId);
                    if (pit != g_drawables.end() && stackMode == 0) {
                        auto& ch = pit->second.children;
                        ch.erase(std::remove(ch.begin(), ch.end(), wid), ch.end());
                        ch.push_back(wid);
                    }
                }
                if (it->second.width != oldW || it->second.height != oldH) {
                    it->second.pixels.assign(static_cast<size_t>(it->second.width) * it->second.height, it->second.bgPixel);
                }
                if (it->second.mapped) g_dirty.store(true);
            }
            break;
        }
        case 14: {  // GetGeometry
            uint32_t did = read32(req + 4, le);
            auto it = g_drawables.find(did);
            if (it == g_drawables.end()) {
                sendError(c, 9, did, 0, op);
                break;
            }
            uint8_t rep[32]{};
            rep[0] = 1;
            rep[1] = it->second.depth;
            write16(rep + 2, c.seq, le);
            write32(rep + 8, ROOT_WINDOW_ID, le);
            write16(rep + 12, static_cast<uint16_t>(it->second.x), le);
            write16(rep + 14, static_cast<uint16_t>(it->second.y), le);
            write16(rep + 16, it->second.width, le);
            write16(rep + 18, it->second.height, le);
            write16(rep + 20, it->second.borderWidth, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 15: {  // QueryTree
            uint32_t wid = read32(req + 4, le);
            auto it = g_drawables.find(wid);
            if (it == g_drawables.end()) {
                sendError(c, 3, wid, 0, op);
                break;
            }
            const auto& ch = it->second.children;
            std::vector<uint8_t> rep(32 + ch.size() * 4, 0);
            rep[0] = 1;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>(ch.size()), le);
            write32(rep.data() + 8, ROOT_WINDOW_ID, le);
            write32(rep.data() + 12, it->second.parentId, le);
            write16(rep.data() + 16, static_cast<uint16_t>(ch.size()), le);
            for (size_t i = 0; i < ch.size(); ++i) {
                write32(rep.data() + 32 + i * 4, ch[i], le);
            }
            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 16: {  // InternAtom
            if (len < 8) break;
            uint16_t nameLen = read16(req + 4, le);
            std::string name;
            if (8 + nameLen <= len) {
                name.assign(reinterpret_cast<const char*>(req + 8), nameLen);
            }
            uint32_t atom = internAtom(name, dataByte != 0);
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 8, atom, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 17: {  // GetAtomName
            uint32_t atom = read32(req + 4, le);
            std::string name = g_atomById.count(atom) ? g_atomById[atom] : "";
            size_t pad = (4 - (name.size() % 4)) % 4;
            std::vector<uint8_t> rep(32 + name.size() + pad, 0);
            rep[0] = 1;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>((name.size() + pad) / 4), le);
            write16(rep.data() + 8, static_cast<uint16_t>(name.size()), le);
            if (!name.empty()) std::memcpy(rep.data() + 32, name.data(), name.size());
            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 18: {  // ChangeProperty
            if (len < 24) break;
            uint32_t wid = read32(req + 4, le);
            uint32_t propAtom = read32(req + 8, le);
            uint32_t typeAtom = read32(req + 12, le);
            uint8_t format = req[16];
            uint32_t numUnits = read32(req + 20, le);
            size_t byteCount = static_cast<size_t>(numUnits) * (format / 8);
            if (24 + byteCount <= len) {
                XProp& prop = g_props[wid][propAtom];
                prop.typeAtom = typeAtom;
                prop.format = format;
                if (dataByte == 0) {
                    prop.data.assign(req + 24, req + 24 + byteCount);
                } else if (dataByte == 1) {
                    prop.data.insert(prop.data.begin(), req + 24, req + 24 + byteCount);
                } else {
                    prop.data.insert(prop.data.end(), req + 24, req + 24 + byteCount);
                }
            }
            break;
        }
        case 19: {  // DeleteProperty
            uint32_t wid = read32(req + 4, le);
            uint32_t propAtom = read32(req + 8, le);
            g_props[wid].erase(propAtom);
            break;
        }
        case 20: {  // GetProperty
            uint32_t wid = read32(req + 4, le);
            uint32_t propAtom = read32(req + 8, le);
            auto wit = g_props.find(wid);
            if (wit == g_props.end() || !wit->second.count(propAtom)) {
                uint8_t rep[32]{};
                rep[0] = 1;
                write16(rep + 2, c.seq, le);
                sendAll(c.fd, rep, 32);
                break;
            }
            const XProp& prop = wit->second[propAtom];
            size_t pad = (4 - (prop.data.size() % 4)) % 4;
            std::vector<uint8_t> rep(32 + prop.data.size() + pad, 0);
            rep[0] = 1;
            rep[1] = prop.format;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>((prop.data.size() + pad) / 4), le);
            write32(rep.data() + 8, prop.typeAtom, le);
            write32(rep.data() + 16, static_cast<uint32_t>(prop.data.size() / std::max<uint8_t>(1, prop.format / 8)), le);
            if (!prop.data.empty()) std::memcpy(rep.data() + 32, prop.data.data(), prop.data.size());
            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 22: {  // SetSelectionOwner
            g_selectionOwners[read32(req + 8, le)] = read32(req + 4, le);
            break;
        }
        case 23: {  // GetSelectionOwner
            uint32_t sel = read32(req + 4, le);
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 8, g_selectionOwners.count(sel) ? g_selectionOwners[sel] : 0, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 26:    // GrabPointer
        case 31: {  // GrabKeyboard
            if (op == 26 && len >= 8) g_pointerGrabWindow = read32(req + 4, le);
            uint8_t rep[32]{};
            rep[0] = 1;
            rep[1] = 0;  // Success
            write16(rep + 2, c.seq, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 27: g_pointerGrabWindow = 0; break;
        case 38: {  // QueryPointer
            uint8_t rep[32]{};
            rep[0] = 1;
            rep[1] = 1;  // same-screen
            write16(rep + 2, c.seq, le);
            write32(rep + 8, ROOT_WINDOW_ID, le);
            write16(rep + 20, static_cast<uint16_t>(g_cursorX), le);
            write16(rep + 22, static_cast<uint16_t>(g_cursorY), le);
            write16(rep + 24, static_cast<uint16_t>(g_cursorX), le);
            write16(rep + 26, static_cast<uint16_t>(g_cursorY), le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 42: {  // SetInputFocus
            g_focusWindow = read32(req + 4, le);
            break;
        }
        case 43: {  // GetInputFocus
            uint8_t rep[32]{};
            rep[0] = 1;
            rep[1] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 8, g_focusWindow, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 53: {  // CreatePixmap
            if (len < 16) break;
            XDrawable pm;
            pm.depth = dataByte == 0 ? 24 : dataByte;
            pm.id = read32(req + 4, le);
            pm.isWindow = false;
            pm.width = std::max<uint16_t>(1, read16(req + 12, le));
            pm.height = std::max<uint16_t>(1, read16(req + 14, le));
            pm.pixels.assign(static_cast<size_t>(pm.width) * pm.height, 0x000000u);
            g_drawables[pm.id] = std::move(pm);
            break;
        }
        case 54: {  // FreePixmap
            g_drawables.erase(read32(req + 4, le));
            break;
        }
        case 55: {  // CreateGC
            if (len < 16) break;
            XGC gc;
            gc.id = read32(req + 4, le);
            uint32_t mask = read32(req + 12, le);
            size_t off = 16;
            for (int bit = 0; bit < 23 && off + 4 <= len; ++bit) {
                if (mask & (1u << bit)) {
                    uint32_t v = read32(req + off, le);
                    if (bit == 0) gc.function = static_cast<uint8_t>(v & 0xF);
                    if (bit == 2) gc.fgPixel = v;
                    if (bit == 3) gc.bgPixel = v;
                    off += 4;
                }
            }
            g_gcs[gc.id] = gc;
            break;
        }
        case 56: {  // ChangeGC
            if (len < 12) break;
            uint32_t gcid = read32(req + 4, le);
            uint32_t mask = read32(req + 8, le);
            auto it = g_gcs.find(gcid);
            if (it != g_gcs.end()) {
                size_t off = 12;
                for (int bit = 0; bit < 23 && off + 4 <= len; ++bit) {
                    if (mask & (1u << bit)) {
                        uint32_t v = read32(req + off, le);
                        if (bit == 0) it->second.function = static_cast<uint8_t>(v & 0xF);
                        if (bit == 2) it->second.fgPixel = v;
                        if (bit == 3) it->second.bgPixel = v;
                        off += 4;
                    }
                }
            }
            break;
        }
        case 60: g_gcs.erase(read32(req + 4, le)); break;
        case 61: {  // ClearArea
            if (len < 16) break;
            uint32_t wid = read32(req + 4, le);
            auto it = g_drawables.find(wid);
            if (it != g_drawables.end()) {
                int16_t rx = readS16(req + 8, le);
                int16_t ry = readS16(req + 10, le);
                uint16_t rw = read16(req + 12, le);
                uint16_t rh = read16(req + 14, le);
                if (rw == 0) rw = it->second.width;
                if (rh == 0) rh = it->second.height;
                for (int py = std::max<int>(0, ry); py < std::min<int>(it->second.height, ry + rh); ++py) {
                    for (int px = std::max<int>(0, rx); px < std::min<int>(it->second.width, rx + rw); ++px) {
                        it->second.pixels[static_cast<size_t>(py) * it->second.width + px] = it->second.bgPixel;
                    }
                }
                if (it->second.mapped) g_dirty.store(true);
            }
            break;
        }
        case 62: {  // CopyArea
            if (len < 28) break;
            uint32_t srcId = read32(req + 4, le);
            uint32_t dstId = read32(req + 8, le);
            auto sit = g_drawables.find(srcId);
            auto dit = g_drawables.find(dstId);
            if (sit != g_drawables.end() && dit != g_drawables.end()) {
                int16_t sx = readS16(req + 16, le);
                int16_t sy = readS16(req + 18, le);
                int16_t dx = readS16(req + 20, le);
                int16_t dy = readS16(req + 22, le);
                uint16_t w = read16(req + 24, le);
                uint16_t h = read16(req + 26, le);
                std::vector<uint32_t> tmp(static_cast<size_t>(w) * h, 0);
                for (uint16_t row = 0; row < h; ++row) {
                    for (uint16_t col = 0; col < w; ++col) {
                        int32_t px = sx + col;
                        int32_t py = sy + row;
                        if (px >= 0 && py >= 0 && px < sit->second.width && py < sit->second.height) {
                            tmp[static_cast<size_t>(row) * w + col] =
                                sit->second.pixels[static_cast<size_t>(py) * sit->second.width + px];
                        }
                    }
                }
                for (uint16_t row = 0; row < h; ++row) {
                    for (uint16_t col = 0; col < w; ++col) {
                        int32_t px = dx + col;
                        int32_t py = dy + row;
                        if (px >= 0 && py >= 0 && px < dit->second.width && py < dit->second.height) {
                            dit->second.pixels[static_cast<size_t>(py) * dit->second.width + px] =
                                tmp[static_cast<size_t>(row) * w + col];
                        }
                    }
                }
                if (dit->second.isWindow && dit->second.mapped) g_dirty.store(true);
            }
            break;
        }
        case 70: {  // PolyFillRectangle
            if (len < 12) break;
            uint32_t did = read32(req + 4, le);
            uint32_t gcid = read32(req + 8, le);
            auto dit = g_drawables.find(did);
            if (dit != g_drawables.end()) {
                uint32_t color = g_gcs.count(gcid) ? g_gcs[gcid].fgPixel : 0xFFFFFFu;
                for (size_t off = 12; off + 8 <= len; off += 8) {
                    int16_t rx = readS16(req + off, le);
                    int16_t ry = readS16(req + off + 2, le);
                    uint16_t rw = read16(req + off + 4, le);
                    uint16_t rh = read16(req + off + 6, le);
                    for (int py = std::max<int>(0, ry); py < std::min<int>(dit->second.height, ry + rh); ++py) {
                        for (int px = std::max<int>(0, rx); px < std::min<int>(dit->second.width, rx + rw); ++px) {
                            dit->second.pixels[static_cast<size_t>(py) * dit->second.width + px] = color;
                        }
                    }
                }
                if (dit->second.isWindow && dit->second.mapped) g_dirty.store(true);
            }
            break;
        }
        case 72: {  // PutImage
            if (len < 24) break;
            uint32_t did = read32(req + 4, le);
            auto dit = g_drawables.find(did);
            if (dit != g_drawables.end()) {
                uint16_t w = read16(req + 12, le);
                uint16_t h = read16(req + 14, le);
                int16_t dx = readS16(req + 16, le);
                int16_t dy = readS16(req + 18, le);
                uint8_t depth = req[21];
                const uint8_t* pxData = req + 24;
                const size_t dataBytes = len - 24;
                if (dataByte == 2 && (depth == 24 || depth == 32)) {  // ZPixmap
                    const size_t expected = static_cast<size_t>(w) * h * 4;
                    if (dataBytes >= expected) {
                        for (uint16_t row = 0; row < h; ++row) {
                            for (uint16_t col = 0; col < w; ++col) {
                                int32_t tx = dx + col;
                                int32_t ty = dy + row;
                                if (tx >= 0 && ty >= 0 && tx < dit->second.width && ty < dit->second.height) {
                                    uint32_t xrgb = read32(pxData + (static_cast<size_t>(row) * w + col) * 4, le);
                                    dit->second.pixels[static_cast<size_t>(ty) * dit->second.width + tx] = xrgb;
                                }
                            }
                        }
                    }
                }
                if (dit->second.isWindow && dit->second.mapped) g_dirty.store(true);
            }
            break;
        }
        case 73: {  // GetImage
            if (len < 20) break;
            uint32_t did = read32(req + 4, le);
            auto dit = g_drawables.find(did);
            if (dit == g_drawables.end()) {
                sendError(c, 9, did, 0, op);
                break;
            }
            int16_t sx = readS16(req + 8, le);
            int16_t sy = readS16(req + 10, le);
            uint16_t w = read16(req + 12, le);
            uint16_t h = read16(req + 14, le);
            size_t payloadBytes = static_cast<size_t>(w) * h * 4;
            std::vector<uint8_t> rep(32 + payloadBytes, 0);
            rep[0] = 1;
            rep[1] = dit->second.depth;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>(payloadBytes / 4), le);
            write32(rep.data() + 8, VISUAL_24_ID, le);
            for (uint16_t row = 0; row < h; ++row) {
                for (uint16_t col = 0; col < w; ++col) {
                    int32_t px = sx + col;
                    int32_t py = sy + row;
                    uint32_t val = 0;
                    if (px >= 0 && py >= 0 && px < dit->second.width && py < dit->second.height) {
                        val = dit->second.pixels[static_cast<size_t>(py) * dit->second.width + px];
                    }
                    write32(rep.data() + 32 + (static_cast<size_t>(row) * w + col) * 4, val, le);
                }
            }
            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 84: {  // AllocColor
            if (len < 16) break;
            uint16_t r = read16(req + 8, le) >> 8;
            uint16_t g = read16(req + 10, le) >> 8;
            uint16_t b = read16(req + 12, le) >> 8;
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            write16(rep + 8, static_cast<uint16_t>(r << 8), le);
            write16(rep + 10, static_cast<uint16_t>(g << 8), le);
            write16(rep + 12, static_cast<uint16_t>(b << 8), le);
            write32(rep + 16, (uint32_t(r) << 16) | (uint32_t(g) << 8) | uint32_t(b), le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 98: {  // QueryExtension
            uint16_t nameLen = read16(req + 4, le);
            std::string ext;
            if (8 + nameLen <= len) ext.assign(reinterpret_cast<const char*>(req + 8), nameLen);
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            if (ext == "BIG-REQUESTS") {
                rep[8] = 1;    // present
                rep[9] = 133;  // major-opcode
            } else {
                rep[8] = 0;    // gracefully force Xlib / Wine ZPixmap fallback
            }
            sendAll(c.fd, rep, 32);
            break;
        }
        case 99: {  // ListExtensions
            uint8_t rep[32 + 16]{};
            rep[0] = 1;
            rep[1] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 4, 4, le);
            rep[32] = 12;
            std::memcpy(rep + 33, "BIG-REQUESTS", 12);
            sendAll(c.fd, rep, 48);
            break;
        }
        case 101: {  // GetKeyboardMapping
            uint8_t firstCode = req[4];
            uint8_t count = req[5];
            uint8_t symsPerCode = 2;
            std::vector<uint8_t> rep(32 + static_cast<size_t>(count) * symsPerCode * 4, 0);
            rep[0] = 1;
            rep[1] = symsPerCode;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>(count * symsPerCode), le);

            auto setSym = [&](int code, uint32_t normal, uint32_t shifted) {
                if (code < firstCode || code >= firstCode + count) return;
                size_t idx = static_cast<size_t>(code - firstCode) * symsPerCode * 4;
                write32(rep.data() + 32 + idx, normal, le);
                write32(rep.data() + 32 + idx + 4, shifted, le);
            };
            // Standard X11 evdev-style keycodes -> ASCII / X11 keysyms
            setSym(9, 0xFF1B, 0xFF1B);    // Esc
            setSym(10, '1', '!'); setSym(11, '2', '@'); setSym(12, '3', '#'); setSym(13, '4', '$');
            setSym(14, '5', '%'); setSym(15, '6', '^'); setSym(16, '7', '&'); setSym(17, '8', '*');
            setSym(18, '9', '('); setSym(19, '0', ')'); setSym(20, '-', '_'); setSym(21, '=', '+');
            setSym(22, 0xFF08, 0xFF08);   // BackSpace
            setSym(23, 0xFF09, 0xFF09);   // Tab
            setSym(24, 'q', 'Q'); setSym(25, 'w', 'W'); setSym(26, 'e', 'E'); setSym(27, 'r', 'R');
            setSym(28, 't', 'T'); setSym(29, 'y', 'Y'); setSym(30, 'u', 'U'); setSym(31, 'i', 'I');
            setSym(32, 'o', 'O'); setSym(33, 'p', 'P'); setSym(34, '[', '{'); setSym(35, ']', '}');
            setSym(36, 0xFF0D, 0xFF0D);   // Return
            setSym(37, 0xFFE3, 0xFFE3);   // Control_L
            setSym(38, 'a', 'A'); setSym(39, 's', 'S'); setSym(40, 'd', 'D'); setSym(41, 'f', 'F');
            setSym(42, 'g', 'G'); setSym(43, 'h', 'H'); setSym(44, 'j', 'J'); setSym(45, 'k', 'K');
            setSym(46, 'l', 'L'); setSym(47, ';', ':'); setSym(48, '\'', '"'); setSym(49, '`', '~');
            setSym(50, 0xFFE1, 0xFFE1);   // Shift_L
            setSym(51, '\\', '|');
            setSym(52, 'z', 'Z'); setSym(53, 'x', 'X'); setSym(54, 'c', 'C'); setSym(55, 'v', 'V');
            setSym(56, 'b', 'B'); setSym(57, 'n', 'N'); setSym(58, 'm', 'M');
            setSym(59, ',', '<'); setSym(60, '.', '>'); setSym(61, '/', '?');
            setSym(64, 0xFFE9, 0xFFE9);   // Alt_L
            setSym(65, ' ', ' ');         // Space
            for (int f = 0; f < 10; ++f) setSym(67 + f, 0xFFBE + f, 0xFFBE + f);  // F1..F10
            setSym(95, 0xFFC8, 0xFFC8);   // F11
            setSym(96, 0xFFC9, 0xFFC9);   // F12
            setSym(110, 0xFF50, 0xFF50);  // Home
            setSym(111, 0xFF52, 0xFF52);  // Up
            setSym(112, 0xFF55, 0xFF55);  // Prior/PgUp
            setSym(113, 0xFF51, 0xFF51);  // Left
            setSym(114, 0xFF53, 0xFF53);  // Right
            setSym(115, 0xFF57, 0xFF57);  // End
            setSym(116, 0xFF54, 0xFF54);  // Down
            setSym(117, 0xFF56, 0xFF56);  // Next/PgDn
            setSym(118, 0xFF63, 0xFF63);  // Insert
            setSym(119, 0xFFFF, 0xFFFF);  // Delete

            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 117: {  // GetPointerMapping
            uint8_t rep[32 + 4]{};
            rep[0] = 1;
            rep[1] = 3;  // 3 mouse buttons mapped (1, 2, 3)
            write16(rep + 2, c.seq, le);
            write32(rep + 4, 1, le);
            rep[32] = 1; rep[33] = 2; rep[34] = 3;
            sendAll(c.fd, rep, 36);
            break;
        }
        case 103: {  // GetKeyboardControl
            uint8_t rep[52]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 4, 5, le);
            sendAll(c.fd, rep, 52);
            break;
        }
        case 108: {  // GetScreenSaver
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 21: {  // ListProperties
            uint32_t wid = read32(req + 4, le);
            auto wit = g_props.find(wid);
            std::vector<uint32_t> atoms;
            if (wit != g_props.end()) {
                for (const auto& kv : wit->second) atoms.push_back(kv.first);
            }
            std::vector<uint8_t> rep(32 + atoms.size() * 4, 0);
            rep[0] = 1;
            write16(rep.data() + 2, c.seq, le);
            write32(rep.data() + 4, static_cast<uint32_t>(atoms.size()), le);
            write16(rep.data() + 8, static_cast<uint16_t>(atoms.size()), le);
            for (size_t i = 0; i < atoms.size(); ++i) {
                write32(rep.data() + 32 + i * 4, atoms[i], le);
            }
            sendAll(c.fd, rep.data(), rep.size());
            break;
        }
        case 40: {  // TranslateCoordinates
            if (len < 16) break;
            uint32_t srcW = read32(req + 4, le);
            uint32_t dstW = read32(req + 8, le);
            int16_t sx = readS16(req + 12, le);
            int16_t sy = readS16(req + 14, le);
            int32_t srcAbsX = 0, srcAbsY = 0, dstAbsX = 0, dstAbsY = 0;
            if (g_drawables.count(srcW)) { srcAbsX = g_drawables[srcW].x; srcAbsY = g_drawables[srcW].y; }
            if (g_drawables.count(dstW)) { dstAbsX = g_drawables[dstW].x; dstAbsY = g_drawables[dstW].y; }
            int16_t dx = static_cast<int16_t>((srcAbsX + sx) - dstAbsX);
            int16_t dy = static_cast<int16_t>((srcAbsY + sy) - dstAbsY);
            uint8_t rep[32]{};
            rep[0] = 1;
            rep[1] = 1;
            write16(rep + 2, c.seq, le);
            write16(rep + 12, static_cast<uint16_t>(dx), le);
            write16(rep + 14, static_cast<uint16_t>(dy), le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 118: {  // GetModifierMapping
            uint8_t rep[32 + 16]{};
            rep[0] = 1;
            rep[1] = 2;
            write16(rep + 2, c.seq, le);
            write32(rep + 4, 4, le);
            sendAll(c.fd, rep, 48);
            break;
        }
        case 119: {  // SetModifierMapping
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        case 133: {  // BIG-REQUESTS Enable
            c.bigRequestsEnabled = true;
            uint8_t rep[32]{};
            rep[0] = 1;
            write16(rep + 2, c.seq, le);
            write32(rep + 8, 1048576u, le);
            sendAll(c.fd, rep, 32);
            break;
        }
        default:
            break;
    }
}

void processClientBuffer(XClient& c) {
    while (true) {
        if (!c.handshakeDone) {
            if (c.rxBuf.size() < 12) return;
            c.littleEndian = (c.rxBuf[0] == 'l');
            uint16_t authNameLen = read16(&c.rxBuf[6], c.littleEndian);
            uint16_t authDataLen = read16(&c.rxBuf[8], c.littleEndian);
            size_t paddedName = (authNameLen + 3) & ~size_t(3);
            size_t paddedData = (authDataLen + 3) & ~size_t(3);
            size_t total = 12 + paddedName + paddedData;
            if (c.rxBuf.size() < total) return;
            c.rxBuf.erase(c.rxBuf.begin(), c.rxBuf.begin() + total);
            c.handshakeDone = true;
            sendSetupReply(c);
            continue;
        }

        if (c.rxBuf.size() < 4) return;
        uint16_t lenWords = read16(&c.rxBuf[2], c.littleEndian);
        size_t reqBytes = 0;
        if (lenWords == 0 && c.bigRequestsEnabled) {
            if (c.rxBuf.size() < 8) return;
            uint32_t bigWords = read32(&c.rxBuf[4], c.littleEndian);
            reqBytes = static_cast<size_t>(bigWords) * 4;
        } else {
            reqBytes = static_cast<size_t>(lenWords) * 4;
        }
        if (reqBytes < 4) reqBytes = 4;
        if (c.rxBuf.size() < reqBytes) return;

        std::vector<uint8_t> packet(c.rxBuf.begin(), c.rxBuf.begin() + reqBytes);
        c.rxBuf.erase(c.rxBuf.begin(), c.rxBuf.begin() + reqBytes);
        handleRequest(c, packet.data(), packet.size());
    }
}

void serverLoop() {
    XLOGI("X11 socket loop started on %s (%dx%d)", g_socketPath.c_str(), g_fbWidth, g_fbHeight);
    uint32_t nextClientBase = 0x00400000u;

    while (g_running.load()) {
        std::vector<pollfd> pfds;
        pfds.push_back({g_listenFd, POLLIN, 0});
        {
            std::lock_guard<std::mutex> lock(g_mutex);
            for (const auto& c : g_clients) {
                pfds.push_back({c.fd, POLLIN, 0});
            }
        }

        int ready = poll(pfds.data(), pfds.size(), 16);
        if (ready < 0) {
            if (errno == EINTR) continue;
            break;
        }

        if (pfds[0].revents & POLLIN) {
            int cfd = accept(g_listenFd, nullptr, nullptr);
            if (cfd >= 0) {
                fcntl(cfd, F_SETFL, O_NONBLOCK);
                std::lock_guard<std::mutex> lock(g_mutex);
                XClient client;
                client.fd = cfd;
                client.idBase = nextClientBase;
                nextClientBase += 0x00200000u;
                g_clients.push_back(std::move(client));
                g_clientCount.store(static_cast<int>(g_clients.size()));
                XLOGI("Accepted X11 client fd=%d (total=%d)", cfd, g_clientCount.load());
            }
        }

        std::lock_guard<std::mutex> lock(g_mutex);
        uint8_t tmp[65536];
        for (size_t i = 1; i < pfds.size() && (i - 1) < g_clients.size(); ++i) {
            if (pfds[i].revents & (POLLIN | POLLERR | POLLHUP)) {
                bool drop = false;
                while (true) {
                    ssize_t n = recv(g_clients[i - 1].fd, tmp, sizeof(tmp), 0);
                    if (n > 0) {
                        g_clients[i - 1].rxBuf.insert(g_clients[i - 1].rxBuf.end(), tmp, tmp + n);
                    } else if (n == 0) {
                        drop = true;
                        break;
                    } else {
                        if (errno == EAGAIN || errno == EWOULDBLOCK) break;
                        drop = true;
                        break;
                    }
                }
                if (!g_clients[i - 1].rxBuf.empty()) {
                    processClientBuffer(g_clients[i - 1]);
                }
                if (drop) {
                    close(g_clients[i - 1].fd);
                    g_clients[i - 1].fd = -1;
                }
            }
        }
        g_clients.erase(
            std::remove_if(g_clients.begin(), g_clients.end(), [](const XClient& c) { return c.fd < 0; }),
            g_clients.end()
        );
        g_clientCount.store(static_cast<int>(g_clients.size()));
    }
}

void renderLoop() {
    while (g_running.load()) {
        presentFrameIfDirty();
        usleep(16000);
    }
}

}  // namespace

bool xserver_start(const std::string& socketPath, int width, int height) {
    xserver_stop();

    std::lock_guard<std::mutex> lock(g_mutex);
    g_fbWidth = std::max(320, width);
    g_fbHeight = std::max(240, height);
    g_cursorX = g_fbWidth / 2;
    g_cursorY = g_fbHeight / 2;
    g_socketPath = socketPath;

    const size_t slash = socketPath.rfind('/');
    if (slash != std::string::npos) {
        std::string dir = socketPath.substr(0, slash);
        mkdir(dir.c_str(), 0777);
        chmod(dir.c_str(), 0777);
    }
    unlink(socketPath.c_str());

    g_listenFd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (g_listenFd < 0) {
        XLOGE("socket() failed: %s", strerror(errno));
        return false;
    }
    fcntl(g_listenFd, F_SETFL, O_NONBLOCK);

    sockaddr_un addr{};
    addr.sun_family = AF_UNIX;
    if (socketPath.size() >= sizeof(addr.sun_path)) {
        XLOGE("Unix socket path too long: %s", socketPath.c_str());
        close(g_listenFd);
        g_listenFd = -1;
        return false;
    }
    std::strncpy(addr.sun_path, socketPath.c_str(), sizeof(addr.sun_path) - 1);

    if (bind(g_listenFd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0 ||
        listen(g_listenFd, 16) < 0) {
        XLOGE("bind/listen failed on %s: %s", socketPath.c_str(), strerror(errno));
        close(g_listenFd);
        g_listenFd = -1;
        return false;
    }
    chmod(socketPath.c_str(), 0777);

    resetWorldLocked();
    g_running.store(true);
    g_serverThread = std::thread(serverLoop);
    g_renderThread = std::thread(renderLoop);
    return true;
}

void xserver_set_surface(ANativeWindow* window) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_window) {
        ANativeWindow_release(g_window);
        g_window = nullptr;
    }
    g_window = window;
    if (g_window) {
        ANativeWindow_setBuffersGeometry(g_window, g_fbWidth, g_fbHeight, WINDOW_FORMAT_RGBX_8888);
        g_dirty.store(true);
    }
}

void xserver_resize(int width, int height) {
    std::lock_guard<std::mutex> lock(g_mutex);
    const int newW = std::clamp(width, 320, 2560);
    const int newH = std::clamp(height, 240, 2560);
    if (newW == g_fbWidth && newH == g_fbHeight) return;

    g_fbWidth = newW;
    g_fbHeight = newH;
    g_cursorX = std::clamp(g_cursorX, 0, g_fbWidth - 1);
    g_cursorY = std::clamp(g_cursorY, 0, g_fbHeight - 1);
    g_backbuffer.assign(static_cast<size_t>(g_fbWidth) * g_fbHeight, 0x0B1120u);

    auto rootIt = g_drawables.find(ROOT_WINDOW_ID);
    if (rootIt != g_drawables.end()) {
        rootIt->second.width = static_cast<uint16_t>(g_fbWidth);
        rootIt->second.height = static_cast<uint16_t>(g_fbHeight);
        rootIt->second.pixels.assign(static_cast<size_t>(g_fbWidth) * g_fbHeight, 0x0B1120u);
    }
    if (g_window) {
        ANativeWindow_setBuffersGeometry(g_window, g_fbWidth, g_fbHeight, WINDOW_FORMAT_RGBX_8888);
    }
    g_dirty.store(true);
    XLOGI("Resized embedded X11 framebuffer dynamically to %dx%d", g_fbWidth, g_fbHeight);
}

void xserver_stop() {
    g_running.store(false);
    if (g_serverThread.joinable()) g_serverThread.join();
    if (g_renderThread.joinable()) g_renderThread.join();

    std::lock_guard<std::mutex> lock(g_mutex);
    for (auto& c : g_clients) {
        if (c.fd >= 0) close(c.fd);
    }
    g_clients.clear();
    g_clientCount.store(0);
    if (g_listenFd >= 0) {
        close(g_listenFd);
        g_listenFd = -1;
    }
    if (!g_socketPath.empty()) {
        unlink(g_socketPath.c_str());
    }
    if (g_window) {
        ANativeWindow_release(g_window);
        g_window = nullptr;
    }
}

void xserver_inject_pointer(int x, int y, int button, int action, int modifiers) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_running.load()) return;

    g_cursorX = std::clamp(x, 0, g_fbWidth - 1);
    g_cursorY = std::clamp(y, 0, g_fbHeight - 1);
    g_dirty.store(true);

    int32_t relX = g_cursorX, relY = g_cursorY;
    uint32_t hitWin = findWindowAt(ROOT_WINDOW_ID, g_cursorX, g_cursorY, 0, 0, relX, relY);
    if (g_pointerGrabWindow != 0) hitWin = g_pointerGrabWindow;
    if (hitWin == 0) hitWin = ROOT_WINDOW_ID;

    uint8_t ev[32]{};
    // action: 0=MotionNotify(6), 1=ButtonPress(4), 2=ButtonRelease(5)
    ev[0] = (action == 1) ? 4 : (action == 2) ? 5 : 6;
    ev[1] = (action == 0) ? 0 : static_cast<uint8_t>(std::clamp(button, 1, 5));
    // Timestamp & windows
    for (auto& c : g_clients) {
        if (!c.handshakeDone || c.fd < 0) continue;
        const bool le = c.littleEndian;
        write16(ev + 2, c.seq, le);
        write32(ev + 4, 1, le);  // time
        write32(ev + 8, ROOT_WINDOW_ID, le);
        write32(ev + 12, hitWin, le);
        write32(ev + 16, 0, le);
        write16(ev + 20, static_cast<uint16_t>(g_cursorX), le);
        write16(ev + 22, static_cast<uint16_t>(g_cursorY), le);
        write16(ev + 24, static_cast<uint16_t>(relX), le);
        write16(ev + 26, static_cast<uint16_t>(relY), le);
        write16(ev + 28, static_cast<uint16_t>(modifiers), le);
        ev[30] = 1;
        sendAll(c.fd, ev, 32);
    }
    if (action == 1 && hitWin != ROOT_WINDOW_ID) {
        g_focusWindow = hitWin;
    }
}

void xserver_inject_key(int xKeycode, bool isDown, int stateMask) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_running.load()) return;

    uint8_t ev[32]{};
    ev[0] = isDown ? 2 : 3;  // KeyPress(2) / KeyRelease(3)
    ev[1] = static_cast<uint8_t>(std::clamp(xKeycode, 8, 255));
    for (auto& c : g_clients) {
        if (!c.handshakeDone || c.fd < 0) continue;
        const bool le = c.littleEndian;
        write16(ev + 2, c.seq, le);
        write32(ev + 4, 1, le);
        write32(ev + 8, ROOT_WINDOW_ID, le);
        write32(ev + 12, g_focusWindow, le);
        write32(ev + 16, 0, le);
        write16(ev + 20, static_cast<uint16_t>(g_cursorX), le);
        write16(ev + 22, static_cast<uint16_t>(g_cursorY), le);
        write16(ev + 24, static_cast<uint16_t>(g_cursorX), le);
        write16(ev + 26, static_cast<uint16_t>(g_cursorY), le);
        write16(ev + 28, static_cast<uint16_t>(stateMask), le);
        ev[30] = 1;
        sendAll(c.fd, ev, 32);
    }
}

int xserver_get_client_count() {
    return g_clientCount.load();
}

int xserver_get_fps() {
    return g_fps.load();
}

}  // namespace wphone
