#pragma once

#include <android/native_window.h>
#include <cstdint>
#include <string>

namespace wphone {

bool xserver_start(const std::string& socketPath, int width, int height);
void xserver_set_surface(ANativeWindow* window);
void xserver_resize(int width, int height);
void xserver_stop();
void xserver_inject_pointer(int x, int y, int button, int action, int modifiers);
void xserver_inject_key(int xKeycode, bool isDown, int stateMask);
int xserver_get_client_count();
int xserver_get_fps();

}  // namespace wphone
