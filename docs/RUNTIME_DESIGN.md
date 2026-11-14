# RUNTIME_DESIGN.md — Desain Runtime WPhone

## Siklus Inisialisasi Pertama Kali
1. **Device Probe**: Membaca `Build.SUPPORTED_ABIS`, total/free RAM, ruang penyimpanan, nama GPU (`EGL_RENDERER`), dan dukungan ekstensi Vulkan.
2. **Rekomendasi Profil**:
   - **Light**: Wine WoW64 + Box64 + PRoot Glibc + AAudio Bridge (~319 MB).
   - **Medium**: Light + DXVK + pustaka dependensi inti (~361 MB).
   - **Advanced**: Medium + Mesa Turnip (bila Adreno) + VKD3D-Proton (~444 MB).
3. **Resumable Provisioning**: Setiap artefak diunduh dengan *range resume* dan diverifikasi SHA-256 sebelum ekstraksi ke `/WPhone/runtime`.

## Siklus Peluncuran Aplikasi
1. Validasi keberadaan komponen runtime yang dipilih konfigurasi aplikasi.
2. Pastikan PulseAudio → AAudio sink aktif dan Display Surface siap.
3. Suntikkan `WINEPREFIX=/WPhone/prefixes/<id>` dan variabel `BOX64_*` / `DXVK_*`.
4. Eksekusi `box64 wine64 <app.exe> [args]`.
5. Saat pengguna menekan hentikan proses, kirim `wineserver -k` secara halus sebelum terminasi paksa.
