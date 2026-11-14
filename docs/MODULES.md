# MODULES.md — Pemetaan Modul WPhone

1. **`ui-android`**: Layar Compose (Wizard, Library, Admin Panel, Keyboard Overlay).
2. **`app-library`**: Katalog aplikasi terdaftar, pencarian, filter kategori, dan metadata shortcut.
3. **`app-installer`**: Orkestrator 4 alur masuk aplikasi (installer `.exe/.msi`, impor direktori, shortcut, konfigurasi).
4. **`app-launcher`**: Menyusun environment variables, argumen Box64/Wine, dan memulai sesi proses.
5. **`runtime-manager`**: Mengunduh, memverifikasi SHA-256, memasang, dan memvalidasi versi komponen runtime.
6. **`compat-wine`**: Antarmuka ke `wine`, `wineserver`, dan `wineboot`.
7. **`cpu-translator`**: Manajemen profil `BOX64_DYNAREC_*` dan validasi arsitektur host.
8. **`graphics-subsystem`**: Seleksi Mesa Turnip, System Vulkan, DXVK, VKD3D-Proton, dan VirGL/WineD3D.
9. **`audio-subsystem`**: Manajemen daemon PulseAudio dan bridge Android AAudio.
10. **`input-keyboard`**: Pemetaan Gaming Pad & Desktop Modifier Bar ke event input.
11. **`prefix-manager`**: Pembuatan, kloning, perbaikan, dan pembersihan `WINEPREFIX`.
12. **`dependency-manager`**: Pelacakan paket seperti `vcrun2022`, `d3dcompiler_47`, dan `corefonts`.
13. **`plugin-host`**: Loader arsip `.wrplugin`, verifikasi izin, dan bridge JS/Python/Java.
14. **`file-manager`**: Operasi berkas aman dengan proteksi direktori inti sistem.
15. **`diagnostics`**: Pengumpul log runtime, crash trace, dan pengekspor laporan pemecahan masalah.
16. **`config-store`**: Penggabungan konfigurasi global dan per-aplikasi.
17. **`localization-helper`**: Kamus multibahasa (ID/EN) serta basis pengetahuan bantuan kontekstual.
