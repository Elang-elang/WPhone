# WPHONE — INSTRUKSI UTAMA PROYEK UNTUK AI AGENT

**Nama proyek:** WPhone (Windows Phone)  
**Platform target:** Android  
**Status dokumen:** Spesifikasi produk awal dan arahan kerja AI Agent  
**Versi:** 1.0

---

## 1. Peran dan tanggung jawab AI Agent

Kamu adalah arsitek perangkat lunak utama, Android engineer, systems engineer, dan agen riset teknis yang bertanggung jawab membantu merancang serta mengembangkan WPhone.

WPhone adalah aplikasi Android yang menyediakan lingkungan terkelola untuk menjalankan aplikasi Windows.

Bekerjalah secara bertahap dan teliti. Jangan terburu-buru membuat banyak kode sebelum kebutuhan, kelayakan teknis, dan arsitektur dipahami.

Tanggung jawabmu:

- Memahami dan mempertahankan seluruh kebutuhan dalam dokumen ini.
- Meneliti proyek open-source dan komponen yang dapat digunakan kembali.
- Memeriksa lisensi, status pemeliharaan, kompatibilitas, dan batasan teknis setiap komponen.
- Menghindari dependensi dan abstraksi yang tidak diperlukan.
- Menjelaskan alasan, risiko, dan kompromi dari setiap keputusan arsitektur.
- Membedakan fakta terverifikasi, asumsi, dan hal yang masih perlu diuji.
- Mengajukan pertanyaan jika ada keputusan penting yang belum dapat disimpulkan.
- Tidak mengubah atau menghilangkan kebutuhan yang telah disepakati secara diam-diam.

**Jangan langsung mengimplementasikan seluruh aplikasi.** Tugas awal adalah menganalisis kebutuhan, melakukan riset, dan menyusun rancangan yang dapat ditinjau.

## 2. Identitas dan tujuan produk

WPhone adalah aplikasi Android untuk menjalankan dan mengelola aplikasi Windows.

WPhone bukan sekadar peluncur game. Sasaran penggunaannya mencakup aplikasi produktivitas, utilitas, alat pengembangan, dan game Windows, sesuai batas kompatibilitas teknis.

### Prinsip produk

1. Performa.
2. Kompatibilitas.
3. Efisiensi penggunaan sumber daya.
4. Fleksibilitas dan kustomisasi.
5. Kesederhanaan.
6. Antarmuka yang informatif.
7. Modularitas dan kemudahan pengembangan.

WPhone harus menyediakan pengaturan yang kuat tanpa membuat pengguna awam kewalahan.

### Konsep lingkungan

WPhone menggunakan **satu sistem terkelola**, bukan menjadikan banyak lingkungan independen sebagai pengalaman utama.

Namun, setiap aplikasi Windows secara default memiliki **Wine prefix tersendiri** untuk mengurangi konflik konfigurasi, registry, dan dependensi.

Konsep ini berarti:

- Satu sistem WPhone.
- Runtime dan komponen global dikelola secara terpusat.
- Prefix aplikasi terpisah.
- Komponen dapat digunakan bersama jika aman dan sesuai secara teknis.
- Konfigurasi dapat diatur secara global maupun per aplikasi.

Jangan menyebut WPhone sebagai mesin virtual Windows penuh. Teliti pendekatan compatibility layer dan translasi yang tepat.

## 3. Arsitektur aplikasi

Rancang WPhone sebagai aplikasi modular. Pisahkan tanggung jawab berikut:

- Antarmuka Android.
- Library aplikasi.
- Instalasi dan impor aplikasi.
- Peluncur aplikasi.
- Pengelolaan runtime.
- Windows compatibility layer.
- Translasi arsitektur CPU.
- Subsistem grafis.
- Subsistem audio.
- Input dan pengelolaan keyboard.
- Pengelolaan prefix.
- Pengelolaan dependensi.
- Sistem plugin.
- File manager.
- Diagnostik dan logging.
- Pengelolaan konfigurasi.
- Sistem bantuan dan informasi multibahasa.

Setiap modul harus memiliki tanggung jawab dan antarmuka yang jelas. Jangan membuat modul atau abstraksi hanya karena terdengar canggih.

## 4. Kompatibilitas aplikasi Windows

Target aplikasi Windows:

- x86 (32-bit).
- x64 (64-bit).

Platform host adalah Android, termasuk perangkat berbasis ARM.

Teliti dan validasi kombinasi teknologi yang mungkin, termasuk:

- Wine.
- Box64.
- Box86.
- WoW64.
- Userspace dan runtime ARM64 yang sesuai.
- Vulkan.
- DXVK.
- VKD3D-Proton jika sesuai.
- Integrasi audio.
- Integrasi native Android.

### Ketentuan teknis penting

- Jangan menganggap Box64 atau Box86 secara langsung menjalankan berkas Windows PE.
- Pahami perannya dalam translasi program Linux userspace dan cara integrasinya dengan Wine.
- Teliti jalur eksekusi aplikasi Windows 32-bit dan 64-bit yang paling sesuai.
- Verifikasi kompatibilitas versi antar-komponen.
- Bedakan arsitektur perangkat host, arsitektur executable Windows, dan arsitektur runtime.
- Jangan menjanjikan semua aplikasi Windows pasti berjalan.

Pilih arsitektur yang paling sederhana, valid secara teknis, dan memiliki keseimbangan performa serta kompatibilitas yang baik.

## 5. Instalasi pertama kali

Saat pertama kali dijalankan, WPhone harus menampilkan wizard penyiapan dan instalasi awal.

WPhone perlu memeriksa kemampuan perangkat dan memberikan rekomendasi konfigurasi.

### Mode Easy

Sediakan tiga profil:

**Light**
- Hanya komponen runtime esensial.
- Ukuran instalasi minimal.
- Cocok untuk perangkat dengan sumber daya terbatas.

**Medium**
- Komponen esensial.
- Komponen tambahan yang dibutuhkan untuk kustomisasi dan kompatibilitas umum.

**Advanced**
- Pilihan komponen yang lebih luas.
- Opsi konfigurasi lebih lengkap.
- Dependensi dan komponen opsional tambahan.

Advanced tidak berarti memasang sistem operasi Windows secara penuh.

### Konfigurasi Advanced

Izinkan pengguna mengatur opsi yang relevan, seperti:

- Arsitektur aplikasi Windows.
- Arsitektur runtime.
- Komponen translasi CPU.
- Backend grafis.
- Konfigurasi audio.
- Pemilihan dependensi.
- Lokasi penyimpanan jika didukung.
- Pengaturan runtime lain yang telah divalidasi.

### Rekomendasi berdasarkan perangkat

Mode Easy dan Advanced harus sama-sama memberikan rekomendasi berdasarkan kemampuan perangkat.

Pertimbangkan:

- Arsitektur dan kemampuan CPU.
- RAM yang tersedia.
- Ruang penyimpanan.
- GPU dan dukungan API grafis.
- Versi Android.
- Kemampuan driver yang relevan.

Pengguna boleh mengubah rekomendasi, tetapi WPhone harus menjelaskan risiko kompatibilitasnya.

### Persyaratan proses instalasi

Proses instalasi harus:

- Menampilkan komponen yang dipilih.
- Menampilkan perkiraan kebutuhan penyimpanan jika tersedia.
- Menampilkan progres.
- Memvalidasi berkas yang diunduh.
- Memverifikasi hasil instalasi.
- Menangani kegagalan dan percobaan ulang.
- Mendukung pemulihan jika instalasi terputus.
- Menghindari pengunduhan komponen yang tidak diperlukan.
- Menyediakan informasi diagnostik.

Setelah inisialisasi berhasil, WPhone membuka halaman library aplikasi.

Pada pembukaan berikutnya, WPhone langsung menuju library aplikasi dan tidak mengulang wizard awal. Sediakan fitur perbaikan atau konfigurasi ulang melalui Settings atau Admin Panel.

## 6. Halaman utama dan library aplikasi

Halaman utama mengambil inspirasi konsep dari JoiPlay, tetapi harus memiliki identitas visual WPhone sendiri.

Library harus mendukung:

- Menampilkan aplikasi Windows yang terpasang atau telah didaftarkan.
- Ikon dan nama aplikasi.
- Pencarian.
- Pengurutan dan filter.
- Kategori aplikasi.
- Menjalankan aplikasi.
- Mengubah pengaturan aplikasi.
- Menghapus pendaftaran aplikasi.
- Mengimpor atau memasang aplikasi.
- Profil keyboard khusus per aplikasi.

## 7. Instalasi dan pengelolaan aplikasi Windows

WPhone wajib mendukung empat metode berikut.

### A. Menjalankan installer

Izinkan pengguna memilih berkas installer Windows, termasuk:

- `.exe`
- `.msi`

Installer dijalankan melalui lingkungan WPhone yang sesuai. Setelah instalasi, sediakan cara untuk mendaftarkan aplikasi hasil instalasi ke library.

### B. Mengimpor aplikasi yang sudah ada

Izinkan pengguna memilih direktori aplikasi yang telah tersedia.

WPhone harus memeriksa isi direktori dan membantu pengguna menentukan executable serta konfigurasi yang diperlukan.

Jangan menganggap semua aplikasi portabel pasti berjalan tanpa dependensi tambahan.

### C. Membuat shortcut aplikasi

Izinkan pengguna memilih executable Windows yang sudah ada dan membuat entri aplikasi tanpa menjalankan installer.

### D. Mengatur konfigurasi aplikasi

Pengguna dapat mengatur:

- Nama aplikasi.
- Ikon aplikasi.
- Executable utama.
- Argumen peluncuran.
- Working directory.
- Wine prefix.
- Environment variables jika sesuai.
- Konfigurasi tampilan.
- Konfigurasi grafis.
- Konfigurasi audio.
- Profil keyboard.
- Opsi per aplikasi lainnya.

Pengaturan aplikasi harus terpisah dari pengaturan global jika memungkinkan.

## 8. Admin Panel

WPhone harus memiliki antarmuka administrasi grafis native Android untuk mengelola lingkungan Windows.

Admin Panel **bukan desktop Windows virtual** dan bukan shell Windows dengan taskbar atau Start Menu. Admin Panel adalah bagian dari WPhone.

Rencanakan bagian berikut.

### Dashboard
- Status sistem.
- Status runtime.
- Informasi CPU.
- Penggunaan RAM.
- Penggunaan penyimpanan.
- Informasi komponen yang terpasang.

### File Manager
- Menjelajahi berkas WPhone.
- Mengelola direktori aplikasi.
- Mengelola prefix.
- Mengelola berkas konfigurasi.
- Mengelola berkas hasil impor.
- Menyediakan perlindungan yang sesuai untuk operasi berkas.

### Application Manager
- Mengelola aplikasi terdaftar.
- Melihat konfigurasi aplikasi.
- Mengelola prefix aplikasi.
- Menghapus pendaftaran aplikasi.
- Memeriksa informasi aplikasi.

### Runtime Manager
- Mengelola komponen runtime yang terpasang.
- Melihat versi.
- Memasang dan menghapus komponen yang didukung.
- Mengelola konfigurasi komponen.
- Memvalidasi kompatibilitas.

### Dependency Manager
- Memeriksa dependensi.
- Memasang dependensi.
- Menghapus dependensi jika aman.
- Mengidentifikasi dependensi yang hilang jika memungkinkan secara teknis.

### Process Manager
- Memeriksa proses Windows yang sedang berjalan.
- Menampilkan informasi proses.
- Menyediakan kontrol penghentian proses yang aman.

### Plugin Manager
- Memasang plugin.
- Mengaktifkan dan menonaktifkan plugin.
- Memeriksa izin plugin.
- Memperbarui dan menghapus plugin.

### Configuration Manager
- Pengaturan global.
- Pengaturan khusus aplikasi.
- Konfigurasi runtime.
- Konfigurasi input.

### Logs dan Diagnostics
- Log runtime.
- Kesalahan saat menjalankan aplikasi.
- Kesalahan instalasi.
- Laporan diagnostik.
- Ekspor informasi pemecahan masalah.

Fitur-fitur tersebut adalah cakupan rancangan. Tidak semuanya wajib masuk versi pertama.

## 9. Sistem keyboard

WPhone harus menyediakan dua sistem keyboard bawaan. Keduanya dapat dikustomisasi.

### A. Gaming Keyboard

Terinspirasi kontrol sentuh seperti JoiPlay.

Dukung:

- D-pad.
- Virtual analog.
- Tombol A/B/X/Y.
- Start dan Select.
- Tombol tambahan yang dapat dikonfigurasi.
- Pemetaan ulang tombol.
- Pengaturan posisi.
- Pengaturan ukuran.
- Transparansi dan tampilan.
- Layout per aplikasi.
- Beberapa preset tersimpan.

### B. Desktop/Application Keyboard

Dirancang untuk aplikasi Windows umum.

Gunakan keyboard Android sebagai metode utama input teks, lalu tambahkan tombol modifier dan tombol desktop yang umumnya tidak tersedia pada keyboard mobile.

Contoh:

- SHIFT.
- CTRL.
- ALT.
- ESC.
- META/COMMAND.
- TAB.
- F1–F12.
- Tombol panah.
- HOME.
- END.
- PAGE UP.
- PAGE DOWN.
- INSERT.
- DELETE.

Dukung:

- Baris tombol yang dapat dikustomisasi.
- Pemetaan ulang tombol.
- Pengaturan layout.
- Perilaku modifier.
- Preset tersimpan.
- Konfigurasi per aplikasi.
- Keyboard fisik jika memungkinkan.

Perpindahan layout keyboard saat aplikasi berjalan harus didukung jika secara teknis memungkinkan.

## 10. Sistem plugin

WPhone harus memiliki arsitektur plugin modular dengan dua kategori utama.

### A. Backend Plugin

Backend plugin dapat:

- Mengatur komponen runtime yang tersedia.
- Menambahkan komponen runtime yang didukung.
- Menyediakan implementasi backend alternatif.
- Mengganti komponen backend yang kompatibel.
- Mengustomisasi konfigurasi grafis dan audio.
- Menambahkan dependensi yang didukung.
- Memperluas fungsi runtime.

Penggantian komponen inti harus melalui validasi kompatibilitas dan perlindungan yang sesuai.

### B. Frontend Plugin

Frontend plugin dapat:

- Mengubah tema.
- Mengustomisasi warna.
- Menambahkan animasi.
- Mengubah elemen antarmuka yang didukung.
- Menambahkan halaman.
- Menambahkan navigasi.
- Menambahkan dialog.
- Menambahkan komponen UI.
- Menambahkan layout keyboard.
- Memperluas fungsi frontend.

Plugin frontend harus menggunakan API terkontrol, bukan memodifikasi kode internal aplikasi tanpa batas.

### Format paket plugin

Gunakan paket plugin berbasis ZIP.

Ekstensi yang diusulkan adalah `.wrplugin`, tetapi teliti apakah ini pilihan terbaik.

Paket harus memiliki manifest di direktori root:

- `plugin.json`, atau
- `plugin.toml`.

Saat memproses arsip, WPhone harus memeriksa direktori root untuk menemukan manifest.

Manifest perlu menjelaskan:

- ID plugin.
- Nama.
- Versi.
- Deskripsi.
- Pembuat.
- Ikon.
- Readme.
- Kategori plugin.
- Lokasi skrip utama.
- Bahasa skrip.
- Versi API yang diperlukan.
- Dependensi.
- Izin.
- Persyaratan kompatibilitas.

Rancang dan dokumentasikan skema final sebelum implementasi.

### Bahasa plugin

Dukung:

- JavaScript.
- Python.
- Java.

Gunakan engine atau integrasi eksekusi yang sesuai untuk setiap bahasa.

Jangan mengonversi modul atau source code Java menjadi Python atau JavaScript.

Sebaliknya, sediakan binding atau bridge khusus bahasa agar plugin dapat menggunakan fungsi WPhone.

Secara konseptual, plugin memperoleh namespace API yang sesuai:

- `wphone.frontend`
- `wphone.backend`

Desain API sebenarnya harus didokumentasikan dan memiliki versi.

Interpreter sebaiknya opsional atau dipasang sesuai kebutuhan jika memungkinkan, agar ukuran instalasi awal tetap kecil.

### Keamanan plugin

Implementasikan:

- Deklarasi izin.
- Peninjauan izin.
- Validasi plugin.
- Verifikasi integritas paket.
- Verifikasi tanda tangan jika sesuai.
- Pembatasan API.
- Pemeriksaan kompatibilitas.
- Operasi aktivasi dan penonaktifan yang aman.
- Penanganan kegagalan plugin.
- Peringatan jelas untuk operasi backend yang memiliki hak istimewa.

Jangan menganggap Wine prefix sebagai sandbox keamanan.

## 11. Helper dan dukungan multibahasa

WPhone harus memiliki sistem informasi dan bantuan bawaan.

Bahasa awal:

- Bahasa Indonesia.
- Bahasa Inggris.

Helper harus menjelaskan:

- Komponen runtime.
- Opsi instalasi.
- Peringatan kompatibilitas.
- Konfigurasi aplikasi.
- Konfigurasi keyboard.
- Izin plugin.
- Kesalahan umum.
- Langkah pemecahan masalah.

Rancang sistem lokalisasi agar bahasa lain dapat ditambahkan kemudian. Jangan menanamkan seluruh teks antarmuka secara langsung di banyak bagian kode.

## 12. Desain antarmuka

Referensi konsep:

- JoiPlay untuk konsep library aplikasi.
- Winlator untuk inspirasi pengaturan runtime.
- Identitas visual WPhone sendiri untuk bagian aplikasi lainnya.

Gunakan pola desain Android modern.

Antarmuka harus:

- Bersih.
- Responsif.
- Dapat dikustomisasi.
- Informatif.
- Mudah dinavigasi.
- Sesuai untuk berbagai ukuran layar.

Jangan menyalin keseluruhan antarmuka aplikasi lain.

Gunakan design system yang konsisten untuk:

- Warna.
- Tipografi.
- Spasi.
- Ikon.
- Komponen.
- Dialog.
- Navigasi.
- Tema.

## 13. Prinsip pengembangan teknis

Evaluasi teknologi yang sesuai melalui riset, bukan memilih tanpa dasar.

Area teknologi yang dapat diteliti:

- Kotlin.
- Android SDK.
- Jetpack Compose.
- Java.
- C/C++.
- JNI.
- Gradle.
- CMake.
- Integrasi runtime native.

Utamakan:

- Integrasi native Android jika sesuai.
- Modul kecil dan mudah dipelihara.
- Komponen open-source yang dapat digunakan kembali.
- API yang terdefinisi dengan baik.
- Dependensi minimal.
- Pengelolaan siklus hidup yang jelas.
- Penanganan kesalahan yang andal.

Untuk setiap komponen eksternal, periksa:

- Lisensi.
- Repositori.
- Status pemeliharaan.
- Arsitektur yang didukung.
- Kompatibilitas versi.
- Kompleksitas integrasi.
- Implikasi keamanan.
- Batasan distribusi.

Jangan menggabungkan komponen yang tidak kompatibel atau tidak terpelihara hanya karena populer.

## 14. Pengelolaan sumber daya

Efisiensi sumber daya merupakan kebutuhan inti.

Rancang sistem dengan mempertimbangkan:

- Ukuran instalasi minimal.
- Komponen opsional.
- Penggunaan bersama sumber daya runtime jika aman.
- Prefix aplikasi terpisah.
- Pengelolaan penyimpanan yang efisien.
- Pembersihan runtime.
- Pengelolaan siklus hidup proses.
- Penghindaran layanan latar belakang yang tidak diperlukan.

Jangan mengorbankan kompatibilitas tanpa menjelaskan komprominya.

## 15. Tahapan pengembangan

Kerjakan proyek dalam fase yang jelas.

### Fase 1 — Analisis kebutuhan
- Analisis seluruh dokumen ini.
- Identifikasi bagian yang ambigu.
- Identifikasi batasan teknis.
- Identifikasi kebutuhan yang belum tercakup.
- Buat dokumen kebutuhan produk.

### Fase 2 — Riset teknis
- Teliti solusi open-source yang tersedia.
- Verifikasi lisensi.
- Bandingkan alternatif arsitektur.
- Validasi jalur eksekusi x86 dan x64.
- Teliti integrasi grafis dan audio.
- Identifikasi risiko teknis utama.

### Fase 3 — Arsitektur sistem
Buat:

- Gambaran arsitektur.
- Tanggung jawab setiap modul.
- Diagram dependensi modul.
- Siklus hidup runtime.
- Desain pengelolaan prefix.
- Arsitektur plugin.
- Alur instalasi aplikasi.
- Model konfigurasi.
- Model keamanan.

### Fase 4 — Spesifikasi UX dan UI
Buat:

- Hierarki layar.
- Alur navigasi.
- Wizard pertama kali.
- Library aplikasi.
- Admin Panel.
- Layar pengelolaan aplikasi.
- Layar kustomisasi keyboard.
- Layar pengelolaan plugin.

### Fase 5 — Prototipe
Buat prototipe kecil yang dapat diuji.

Jangan mencoba mengimplementasikan seluruh sistem sekaligus.

Validasi komponen yang memiliki risiko teknis tertinggi sejak awal.

### Fase 6 — Implementasi bertahap
Implementasikan satu modul pada satu waktu.

Untuk setiap modul:

1. Tentukan kebutuhannya.
2. Definisikan API.
3. Implementasikan.
4. Uji.
5. Dokumentasikan.
6. Validasi integrasi.
7. Lanjutkan ke modul berikutnya.

### Fase 7 — Integrasi dan pengujian
Uji:

- Instalasi.
- Inisialisasi runtime.
- Eksekusi aplikasi.
- Jalur kompatibilitas x86 dan x64.
- Isolasi prefix.
- Grafis.
- Audio.
- Input keyboard.
- Pemuatan plugin.
- Penanganan izin.
- Pemulihan dan diagnostik.

### Fase 8 — Persiapan rilis
Siapkan:

- Build rilis.
- Versioning.
- Paket instalasi.
- Dokumentasi.
- Daftar batasan yang diketahui.
- Informasi kompatibilitas.
- Prosedur pembaruan dan migrasi.

## 16. Dokumentasi wajib

Pelihara dokumen berikut di repositori proyek:

1. `PRODUCT_SPEC.md`
2. `TECHNICAL_RESEARCH.md`
3. `ARCHITECTURE.md`
4. `MODULES.md`
5. `RUNTIME_DESIGN.md`
6. `PREFIX_MANAGEMENT.md`
7. `PLUGIN_SPEC.md`
8. `KEYBOARD_SPEC.md`
9. `UI_UX_SPEC.md`
10. `SECURITY.md`
11. `ROADMAP.md`
12. `DECISIONS.md`

Catat keputusan teknis yang penting beserta alasannya.

Perbarui dokumentasi setiap kali keputusan arsitektur yang telah disetujui berubah.

## 17. Aturan kerja AI Agent

Aturan berikut wajib dipatuhi:

- Jangan memulai implementasi penuh sebelum arsitektur disetujui.
- Jangan mengarang kemampuan teknis.
- Jangan mengklaim kompatibilitas tanpa bukti.
- Jangan mengubah kebutuhan yang telah disepakati secara diam-diam.
- Jangan menambahkan dependensi tanpa alasan.
- Jangan membuat kompleksitas yang tidak diperlukan.
- Jangan mengklaim fitur selesai jika hanya berupa placeholder.
- Jangan menimpa berkas pengguna tanpa izin.
- Jangan melakukan operasi destruktif tanpa konfirmasi.
- Jaga perubahan tetap modular dan mudah ditinjau.
- Laporkan pekerjaan yang belum selesai dengan jujur.
- Jelaskan kompromi teknis yang penting.
- Ajukan pertanyaan secara ringkas jika diperlukan.
- Utamakan implementasi yang benar-benar berjalan dan dapat diuji daripada rancangan rumit yang belum tervalidasi.

Jika informasi belum pasti, beri label secara eksplisit:

- **Terverifikasi**
- **Kemungkinan**
- **Belum terverifikasi**
- **Perlu pengujian**
- **Belum memungkinkan saat ini**

## 18. Tugas pertama AI Agent

Tugas pertama bukan menulis seluruh aplikasi WPhone.

Mulailah dengan:

1. Menganalisis seluruh kebutuhan dalam instruksi ini.
2. Membuat Product Requirements Document yang terstruktur.
3. Mencatat ketidakpastian dan risiko teknis.
4. Meneliti arsitektur paling layak untuk menjalankan aplikasi Windows di Android.
5. Membandingkan komponen open-source yang tersedia.
6. Mengusulkan arsitektur modular.
7. Mengusulkan roadmap pengembangan.
8. Mencatat keputusan yang membutuhkan persetujuan pengguna.

Sajikan hasilnya sebagai laporan terstruktur.

**Jangan memulai implementasi penuh sebelum arsitektur dan keputusan teknis utama ditinjau serta disetujui.**

---

## Tujuan akhir

Bangun WPhone sebagai platform Android yang modular, mudah dipelihara, dan hemat sumber daya untuk menjalankan serta mengelola aplikasi Windows.

WPhone harus memiliki:

- Library aplikasi yang mudah digunakan.
- Lingkungan Windows terkelola dengan prefix per aplikasi.
- Admin Panel berbasis GUI Android.
- Sistem keyboard yang dapat dikustomisasi.
- Sistem plugin frontend dan backend.
- Dukungan aplikasi Windows x86 dan x64 sesuai kemampuan teknis.
- Sistem bantuan multibahasa.
- Arsitektur yang dapat dikembangkan secara bertahap.

**Prinsip utama: rancang dengan cermat, validasi sebelum memilih, implementasikan secara bertahap, dan jangan menambahkan kompleksitas tanpa kebutuhan nyata.**
