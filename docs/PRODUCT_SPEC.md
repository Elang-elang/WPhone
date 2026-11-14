# PRODUCT_SPEC.md — Spesifikasi Produk WPhone

## 1. Visi & Posisi Produk
WPhone (Windows Phone) adalah platform Android yang menyediakan lingkungan terkelola untuk menjalankan aplikasi Windows x86 (32-bit) dan x64 (64-bit) secara modular dan hemat sumber daya. WPhone **bukan** mesin virtual Windows penuh dan bukan sekadar peluncur game; target penggunaannya mencakup aplikasi produktivitas, utilitas sistem, alat pengembang, dan game Windows sesuai batas kompatibilitas teknis.

## 2. Prinsip Produk
1. **Performa**: Jalur eksekusi Wine WoW64 + Box64 dengan akselerasi Vulkan/DXVK dan AAudio berlatensi rendah.
2. **Kompatibilitas**: Isolasi Wine prefix per aplikasi untuk mencegah konflik DLL dan registry.
3. **Efisiensi Sumber Daya**: Komponen runtime global dipakai bersama secara *read-only*, hanya mengunduh modul yang diperlukan profil perangkat.
4. **Fleksibilitas & Kustomisasi**: Mode Easy (Light/Medium/Advanced) untuk pemula dan Mode Advanced untuk *power user*.
5. **Kesederhanaan & Informatif**: Wizard deteksi perangkat keras serta penjelas risiko kompatibilitas multibahasa (ID/EN).

## 3. Model Lingkungan Terkelola
- **Satu sistem WPhone**: Pengelolaan runtime, driver grafis, dan bridge audio terpusat.
- **Prefix terisolasi per aplikasi**: Setiap aplikasi terdaftar memiliki `WINEPREFIX` tersendiri (`/WPhone/prefixes/<app-id>`).
- **Pemisahan konfigurasi**: Pengaturan global menjadi baseline, sementara pengaturan per aplikasi dapat melakukan *override* argumen, variabel lingkungan, grafis, audio, dan profil keyboard.

## 4. Cakupan Fungsional Inti
- **Wizard Instalasi Pertama**: Deteksi kapabilitas perangkat, profil Light/Medium/Advanced, validasi hash, pemulihan instalasi terputus.
- **Library Aplikasi**: Tampilan inspirasi JoiPlay beridentitas WPhone, pencarian, kategori, sort, dan 4 metode manajemen (.exe/.msi installer, impor direktori, buat shortcut, edit konfigurasi).
- **Admin Panel Native Android**: Dashboard, File Manager terlindungi, Application Manager, Runtime Manager, Logs & Diagnostics (+ roadmap Dependency, Process, dan Plugin Manager).
- **Sistem Dual Keyboard & Plugin**: Gaming Keyboard & Desktop/Application Keyboard + arsitektur plugin `.wrplugin` (Frontend & Backend).
