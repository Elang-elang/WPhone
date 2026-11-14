cmake_minimum_required(VERSION 3.22.1)
project("wphone_native")

add_library(wphone_native SHARED
    wphone_jni.cpp
    aaudio_bridge.cpp
    wphone_xserver.cpp
)

find_library(log-lib log)
find_library(android-lib android)
find_library(opensles-lib OpenSLES)

target_link_libraries(wphone_native
    ${log-lib}
    ${android-lib}
    ${opensles-lib}
    dl
)
