#include <aaudio/AAudio.h>
#include <android/log.h>

#define LOG_TAG "WPhoneAAudio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace wphone::audio {

/**
 * Low-latency AAudio sink bridge receiving PCM frames forwarded from
 * PulseAudio inside the userspace PRoot/glibc container.
 * Status: Needs on-device latency/buffer tuning across OEM HALs.
 */
class AAudioSinkBridge {
public:
    bool openStream(int32_t sampleRate = 48000, int32_t channels = 2) {
        AAudioStreamBuilder* builder = nullptr;
        if (AAudio_createStreamBuilder(&builder) != AAUDIO_OK || !builder) {
            return false;
        }
        AAudioStreamBuilder_setDirection(builder, AAUDIO_DIRECTION_OUTPUT);
        AAudioStreamBuilder_setSampleRate(builder, sampleRate);
        AAudioStreamBuilder_setChannelCount(builder, channels);
        AAudioStreamBuilder_setFormat(builder, AAUDIO_FORMAT_PCM_I16);
        AAudioStreamBuilder_setPerformanceMode(builder, AAUDIO_PERFORMANCE_MODE_LOW_LATENCY);

        const aaudio_result_t res = AAudioStreamBuilder_openStream(builder, &stream_);
        AAudioStreamBuilder_delete(builder);
        if (res != AAUDIO_OK) {
            stream_ = nullptr;
            return false;
        }
        LOGI("Opened Android AAudio low-latency output stream (%d Hz, %d ch)", sampleRate, channels);
        return AAudioStream_requestStart(stream_) == AAUDIO_OK;
    }

    void closeStream() {
        if (stream_) {
            AAudioStream_requestStop(stream_);
            AAudioStream_close(stream_);
            stream_ = nullptr;
        }
    }

private:
    AAudioStream* stream_ = nullptr;
};

} // namespace wphone::audio
