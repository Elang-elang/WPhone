# SECURITY.md — Keamanan & Integritas WPhone

1. **Integritas Runtime**: Seluruh unduhan Wine, Box64, DXVK, dan Turnip wajib melalui verifikasi checksum SHA-256 sebelum diekstrak ke direktori `runtime` yang dilindungi.
2. **Batas Prefix**: Wine prefix hanya mengisolasi registry dan berkas konfigurasi aplikasi Windows — **bukan** sandbox keamanan OS. Berkas Windows yang tidak tepercaya tetap berisiko mengakses direktori yang dipetakan (`Z:\` atau folder impor).
3. **Proteksi File Manager**: Direktori inti `/WPhone/runtime` dan `/WPhone/config` dilindungi terhadap penghapusan tidak sengaja.
4. **Kontrol Plugin**: Setiap paket `.wrplugin` harus mendeklarasikan izin eksplisit di manifest. Plugin frontend dibatasi ke API UI terkontrol; plugin backend yang menyentuh environment runtime menampilkan peringatan hak istimewa sebelum aktivasi.
