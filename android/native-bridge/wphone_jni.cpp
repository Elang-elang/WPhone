#include <jni.h>
#include <string>
#include <sys/wait.h>
#include <unistd.h>
#include <android/log.h>

#define LOG_TAG "WPhoneJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

extern "C" JNIEXPORT jstring JNICALL
Java_id_wphone_WPhoneNativeBridge_getNativeAbiInfo(JNIEnv* env, jobject /* this */) {
#if defined(__aarch64__)
    const char* arch = "arm64-v8a (Box64 + Wine WoW64 ready)";
#else
    const char* arch = "non-arm64 (unsupported for Box64)";
#endif
    return env->NewStringUTF(arch);
}

extern "C" JNIEXPORT jint JNICALL
Java_id_wphone_WPhoneNativeBridge_terminateProcessGracefully(JNIEnv* /* env */, jobject /* this */, jint pid) {
    if (pid <= 1) return -1;
    LOGI("Sending SIGTERM to managed Wine/Box64 process PID=%d", pid);
    return kill(static_cast<pid_t>(pid), SIGTERM);
}
