# ARCHITECTURE.md — Arsitektur Sistem WPhone

```text
+-------------------------------------------------------------------+
|  PRESENTATION LAYER (Android Kotlin + Jetpack Compose)            |
|  • Setup Wizard   • App Library   • Admin Panel   • Dual Keyboard |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|  ORCHESTRATION & DOMAIN LAYER                                     |
|  • AppRegistry    • PrefixManager  • RuntimeManager • PluginHost  |
|  • ConfigStore    • Diagnostics    • Localization (ID/EN)         |
+---------------------------------+---------------------------------+
                                  | JNI / Local Socket
                                  v
+-------------------------------------------------------------------+
|  NATIVE ANDROID BRIDGES (C/C++ NDK)                               |
|  • Display Surface (SurfaceView / X11-Wayland)                    |
|  • Audio Sink (Android AAudio ◄── PulseAudio Socket)              |
|  • Input Bridge (Touch/Gamepad/IME ──► XInput/XTest Events)       |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|  USERSPACE COMPATIBILITY CONTAINER (PRoot / Glibc)                |
|  • Box64 Dynarec (x86_64/WoW64 → ARM64)                           |
|  • Wine 9.21+ WoW64 (PE x86 & x64 → POSIX)                        |
|  • DXVK / VKD3D-Proton → Mesa Turnip (Adreno) / System Vulkan     |
+-------------------------------------------------------------------+
```

## Prinsip Pemisahan
1. **Shared Runtime (Read-Only)**: Komponen biner Wine, Box64, DXVK, dan Turnip dipasang terpusat di `/WPhone/runtime`.
2. **Isolated Prefix (Read-Write)**: Setiap aplikasi menulis registry dan berkas sistem ke `/WPhone/prefixes/<app-id>`.
3. **Zero Silent Degradation**: Setiap kegagalan komponen menghasilkan log diagnostik terstruktur dan saran pemecahan masalah.
