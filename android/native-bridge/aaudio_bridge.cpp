#include <SLES/OpenSLES.h>
#include <SLES/OpenSLES_Android.h>
#include <android/api-level.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>

#define LOG_TAG "WPhoneAudio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace wphone::audio {

/**
 * Adaptive Audio Sink Bridge supporting Android 7.0+ (API 24+):
 * - Dynamically resolves libaaudio.so via dlopen/dlsym on Android 8.1+ (API 27+)
 *   when not running in Low-RAM Legacy mode.
 * - Falls back cleanly to universal OpenSL ES (API 24–26 and sub-Android 10 devices)
 *   without causing missing-symbol crashes on older OS builds.
 */
class AdaptiveAudioSinkBridge {
public:
    bool openStream(int32_t sampleRate = 48000, int32_t channels = 2, bool preferLowMemoryLegacy = false) {
        const int apiLevel = android_get_device_api_level();
        if (!preferLowMemoryLegacy && apiLevel >= 27 && tryOpenDynamicAAudio(sampleRate, channels)) {
            activeMode_ = "AAudio (API 27+ dynamic)";
            return true;
        }
        if (openOpenSLES(sampleRate, channels)) {
            activeMode_ = "OpenSL ES (Android 7.0+ universal)";
            return true;
        }
        activeMode_ = "ALSA/Null fallback";
        return false;
    }

    const char* activeMode() const { return activeMode_; }

    void closeStream() {
        if (aaudioHandle_) {
            if (aaudioStream_ && aaudioStopFn_ && aaudioCloseFn_) {
                aaudioStopFn_(aaudioStream_);
                aaudioCloseFn_(aaudioStream_);
            }
            dlclose(aaudioHandle_);
            aaudioHandle_ = nullptr;
            aaudioStream_ = nullptr;
        }
        if (slPlayerObj_) {
            (*slPlayerObj_)->Destroy(slPlayerObj_);
            slPlayerObj_ = nullptr;
        }
        if (slMixObj_) {
            (*slMixObj_)->Destroy(slMixObj_);
            slMixObj_ = nullptr;
        }
        if (slEngineObj_) {
            (*slEngineObj_)->Destroy(slEngineObj_);
            slEngineObj_ = nullptr;
        }
    }

private:
    using FnCreateBuilder = int32_t (*)(void**);
    using FnSetInt = void (*)(void*, int32_t);
    using FnOpenStream = int32_t (*)(void*, void**);
    using FnDeleteBuilder = int32_t (*)(void*);
    using FnStreamOp = int32_t (*)(void*);

    bool tryOpenDynamicAAudio(int32_t sampleRate, int32_t channels) {
        void* lib = dlopen("libaaudio.so", RTLD_NOW | RTLD_LOCAL);
        if (!lib) return false;

        auto createBuilder = reinterpret_cast<FnCreateBuilder>(dlsym(lib, "AAudio_createStreamBuilder"));
        auto setRate = reinterpret_cast<FnSetInt>(dlsym(lib, "AAudioStreamBuilder_setSampleRate"));
        auto setChan = reinterpret_cast<FnSetInt>(dlsym(lib, "AAudioStreamBuilder_setChannelCount"));
        auto openFn = reinterpret_cast<FnOpenStream>(dlsym(lib, "AAudioStreamBuilder_openStream"));
        auto delBuilder = reinterpret_cast<FnDeleteBuilder>(dlsym(lib, "AAudioStreamBuilder_delete"));
        auto startFn = reinterpret_cast<FnStreamOp>(dlsym(lib, "AAudioStream_requestStart"));
        auto stopFn = reinterpret_cast<FnStreamOp>(dlsym(lib, "AAudioStream_requestStop"));
        auto closeFn = reinterpret_cast<FnStreamOp>(dlsym(lib, "AAudioStream_close"));

        if (!createBuilder || !setRate || !setChan || !openFn || !delBuilder || !startFn) {
            dlclose(lib);
            return false;
        }

        void* builder = nullptr;
        if (createBuilder(&builder) != 0 || !builder) {
            dlclose(lib);
            return false;
        }
        setRate(builder, sampleRate);
        setChan(builder, channels);
        void* stream = nullptr;
        const int32_t res = openFn(builder, &stream);
        delBuilder(builder);
        if (res != 0 || !stream) {
            dlclose(lib);
            return false;
        }
        if (startFn(stream) != 0) {
            if (closeFn) closeFn(stream);
            dlclose(lib);
            return false;
        }

        aaudioHandle_ = lib;
        aaudioStream_ = stream;
        aaudioStopFn_ = stopFn;
        aaudioCloseFn_ = closeFn;
        LOGI("Opened dynamic AAudio sink (%d Hz, %d ch)", sampleRate, channels);
        return true;
    }

    bool openOpenSLES(int32_t sampleRate, int32_t channels) {
        if (slCreateEngine(&slEngineObj_, 0, nullptr, 0, nullptr, nullptr) != SL_RESULT_SUCCESS) {
            return false;
        }
        if ((*slEngineObj_)->Realize(slEngineObj_, SL_BOOLEAN_FALSE) != SL_RESULT_SUCCESS) {
            return false;
        }
        SLEngineItf engineItf = nullptr;
        if ((*slEngineObj_)->GetInterface(slEngineObj_, SL_IID_ENGINE, &engineItf) != SL_RESULT_SUCCESS) {
            return false;
        }
        if ((*engineItf)->CreateOutputMix(engineItf, &slMixObj_, 0, nullptr, nullptr) != SL_RESULT_SUCCESS) {
            return false;
        }
        (*slMixObj_)->Realize(slMixObj_, SL_BOOLEAN_FALSE);

        SLDataLocator_AndroidSimpleBufferQueue locBufq = {SL_DATALOCATOR_ANDROIDSIMPLEBUFFERQUEUE, 2};
        SLDataFormat_PCM formatPcm = {
            SL_DATAFORMAT_PCM,
            static_cast<SLuint32>(channels),
            static_cast<SLuint32>(sampleRate) * 1000,
            SL_PCMSAMPLEFORMAT_FIXED_16,
            SL_PCMSAMPLEFORMAT_FIXED_16,
            channels == 2 ? (SL_SPEAKER_FRONT_LEFT | SL_SPEAKER_FRONT_RIGHT) : SL_SPEAKER_FRONT_CENTER,
            SL_BYTEORDER_LITTLEENDIAN
        };
        SLDataSource audioSrc = {&locBufq, &formatPcm};
        SLDataLocator_OutputMix locOutmix = {SL_DATALOCATOR_OUTPUTMIX, slMixObj_};
        SLDataSink audioSnk = {&locOutmix, nullptr};
        const SLInterfaceID ids[1] = {SL_IID_BUFFERQUEUE};
        const SLboolean req[1] = {SL_BOOLEAN_TRUE};

        if ((*engineItf)->CreateAudioPlayer(engineItf, &slPlayerObj_, &audioSrc, &audioSnk, 1, ids, req) != SL_RESULT_SUCCESS) {
            return false;
        }
        (*slPlayerObj_)->Realize(slPlayerObj_, SL_BOOLEAN_FALSE);
        LOGI("Opened OpenSL ES universal PCM sink (%d Hz, %d ch)", sampleRate, channels);
        return true;
    }

    const char* activeMode_ = "Uninitialized";
    void* aaudioHandle_ = nullptr;
    void* aaudioStream_ = nullptr;
    FnStreamOp aaudioStopFn_ = nullptr;
    FnStreamOp aaudioCloseFn_ = nullptr;

    SLObjectItf slEngineObj_ = nullptr;
    SLObjectItf slMixObj_ = nullptr;
    SLObjectItf slPlayerObj_ = nullptr;
};

} // namespace wphone::audio
