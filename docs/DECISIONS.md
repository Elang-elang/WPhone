# DECISIONS.md — Catatan Keputusan Arsitektur

## ADR-001: Memilih Wine WoW64 + Box64 sebagai Baseline x86 & x64
- **Keputusan**: Memprioritaskan Wine WoW64 + Box64 daripada bundel terpisah Box86 + Box64.
- **Alasan**: Menghilangkan ketergantungan pada rootfs 32-bit dan kernel ARM32 ABI yang makin jarang tersedia pada Android modern.
- **Risiko**: Beberapa aplikasi Windows 32-bit legacy tertentu perlu pengujian kompatibilitas di mode WoW64.

## ADR-002: Satu Sistem Terkelola + Prefix Terisolasi Per Aplikasi
- **Keputusan**: Runtime global dibagi secara *read-only*, sementara `WINEPREFIX` dipisah per aplikasi.
- **Alasan**: Menghemat ratusan MB penyimpanan dibanding menggandakan runtime per wadah, sambil tetap mencegah bentrok registry/DLL.

## ADR-003: Admin Panel Native Android (Bukan Desktop Shell Windows)
- **Keputusan**: Manajemen sistem dilakukan lewat GUI native Android yang bersih (Dashboard, File, App, Runtime, Logs).
- **Alasan**: Lebih ergonomis untuk layar sentuh ponsel, ringan, dan selaras dengan prinsip kesederhanaan WPhone.

## ADR-004: Format Plugin ZIP `.wrplugin` dengan Manifest Root
- **Keputusan**: Menggunakan arsip ZIP ber-ekstensi `.wrplugin` berisi `plugin.json` atau `plugin.toml`.
- **Alasan**: Mudah divalidasi integritasnya, tidak memerlukan compiler saat instalasi, dan mendukung bridge multi-bahasa.
