#include <jni.h>
#include <android/api-level.h>
#include <android/log.h>
#include <dlfcn.h>
#include <sys/wait.h>
#include <unistd.h>
#include <string>

#define LOG_TAG "WPhoneJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

extern "C" JNIEXPORT jstring JNICALL
Java_id_wphone_WPhoneNativeBridge_getNativeAbiInfo(JNIEnv* env, jobject /* this */) {
    const int apiLevel = android_get_device_api_level();
#if defined(__aarch64__)
    const std::string arch = "arm64-v8a · API " + std::to_string(apiLevel) + " (Wine WoW64 + Box64 ready)";
#elif defined(__arm__)
    const std::string arch = "armeabi-v7a · API " + std::to_string(apiLevel) + " (x86 legacy lightweight mode)";
#else
    const std::string arch = "x86/host · API " + std::to_string(apiLevel);
#endif
    return env->NewStringUTF(arch.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_id_wphone_WPhoneNativeBridge_getRecommendedAudioBackend(
    JNIEnv* env,
    jobject /* this */,
    jboolean preferLightweight
) {
    const int apiLevel = android_get_device_api_level();
    if (preferLightweight || apiLevel < 27) {
        return env->NewStringUTF("OPENSL_ES");
    }
    void* lib = dlopen("libaaudio.so", RTLD_LAZY | RTLD_LOCAL);
    if (lib) {
        dlclose(lib);
        return env->NewStringUTF("AAUDIO");
    }
    return env->NewStringUTF("OPENSL_ES");
}

extern "C" JNIEXPORT jint JNICALL
Java_id_wphone_WPhoneNativeBridge_getHostPageSizeKb(JNIEnv* /* env */, jobject /* this */) {
    const long pageBytes = sysconf(_SC_PAGESIZE);
    return static_cast<jint>(pageBytes > 0 ? pageBytes / 1024L : 4);
}

extern "C" JNIEXPORT jint JNICALL
Java_id_wphone_WPhoneNativeBridge_terminateProcessGracefully(JNIEnv* /* env */, jobject /* this */, jint pid) {
    if (pid <= 1) return -1;
    LOGI("Sending SIGTERM to managed Wine/Box64 process PID=%d", pid);
    return kill(static_cast<pid_t>(pid), SIGTERM);
}
