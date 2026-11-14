# ROADMAP.md — Tahapan Pengembangan WPhone

- **Fase 1–4 (Selesai pada Dokumen & Prototipe)**: Analisis kebutuhan, riset lisensi & Wine WoW64 + Box64, arsitektur modular 17 modul, spesifikasi UX/UI, dan prototipe web interaktif.
- **Fase 5 — Prototipe Native Risiko Tinggi**: Uji eksekusi headless `box64 wine64` + PulseAudio→AAudio + SurfaceView pada perangkat Android ARM64 fisik (Adreno & Mali).
- **Fase 6 — Implementasi Bertahap Android**: Bangun modul satu per satu (`config-store` → `runtime-manager` → `prefix-manager` → `app-library` → `admin-panel` → `input-keyboard` → `plugin-host`).
- **Fase 7 — Pengujian Lintas Perangkat**: Uji jalur x86/x64 WoW64, isolasi prefix, skenario crash/recovery, dan profil baterai/termal.
- **Fase 8 — Persiapan Rilis**: Build APK/AAB modular (opsi unduhan runtime on-demand), dokumentasi kepatuhan lisensi LGPL/MIT/zlib, dan prosedur migrasi prefix.
