import { EngineeringDoc } from '../types/wphone';

export const ENGINEERING_DOCS: EngineeringDoc[] = [
  {
    id: 'product-spec',
    filename: 'PRODUCT_SPEC.md',
    titleId: 'Spesifikasi Kebutuhan Produk (PRD)',
    titleEn: 'Product Requirements Document (PRD)',
    phase: '01 · Analisis Kebutuhan',
    summaryId: 'Identitas produk WPhone, prinsip inti, konsep satu sistem terkelola dengan Wine prefix terpisah, serta cakupan fitur utama.',
    summaryEn: 'WPhone identity, core principles, single managed system with per-app isolated Wine prefixes, and primary feature scope.',
    contentId: `# PRODUCT_SPEC.md — Spesifikasi Produk WPhone

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
- **Prefix terisolasi per aplikasi**: Setiap aplikasi terdaftar memiliki \`WINEPREFIX\` tersendiri (\`/WPhone/prefixes/<app-id>\`).
- **Pemisahan konfigurasi**: Pengaturan global menjadi baseline, sementara pengaturan per aplikasi dapat melakukan *override* argumen, variabel lingkungan, grafis, audio, dan profil keyboard.

## 4. Cakupan Fungsional Inti
- **Wizard Instalasi Pertama**: Deteksi kapabilitas perangkat, profil Light/Medium/Advanced, validasi hash, pemulihan instalasi terputus.
- **Library Aplikasi**: Tampilan inspirasi JoiPlay beridentitas WPhone, pencarian, kategori, sort, dan 4 metode manajemen (.exe/.msi installer, impor direktori, buat shortcut, edit konfigurasi).
- **Admin Panel Native Android**: Dashboard, File Manager terlindungi, Application Manager, Runtime Manager, Logs & Diagnostics (+ roadmap Dependency, Process, dan Plugin Manager).
- **Sistem Dual Keyboard & Plugin**: Gaming Keyboard & Desktop/Application Keyboard + arsitektur plugin \`.wrplugin\` (Frontend & Backend).`,
    contentEn: `# PRODUCT_SPEC.md — WPhone Product Requirements

## 1. Product Vision & Positioning
WPhone is a modular Android platform providing a managed compatibility environment to run x86 (32-bit) and x64 (64-bit) Windows applications. WPhone is **not** a full Windows virtual machine and not merely a game launcher; target workloads span productivity suites, desktop utilities, developer tools, and compatible Windows games.

## 2. Core Principles
1. **Performance**: Wine WoW64 + Box64 translation pipeline paired with Vulkan/DXVK graphics and low-latency AAudio.
2. **Compatibility**: Isolated per-app Wine prefixes to prevent registry and DLL override collisions.
3. **Resource Efficiency**: Shared read-only global runtime layers; modular optional component downloads.
4. **Flexibility**: Curated Easy profiles (Light/Medium/Advanced) alongside transparent Advanced overrides.
5. **Clarity**: Device capability advisor and bilingual (ID/EN) explanations of compatibility risks.

## 3. Managed Environment Model
- **Single WPhone System**: Centralized runtime, graphics driver, and audio bridge management.
- **Per-App Prefix Isolation**: Each registered app receives its own \`WINEPREFIX\` directory (\`/WPhone/prefixes/<app-id>\`).
- **Scoped Configuration**: Global defaults cascade to per-app overrides for arguments, env vars, graphics, audio, and keyboard layouts.`,
  },
  {
    id: 'technical-research',
    filename: 'TECHNICAL_RESEARCH.md',
    titleId: 'Riset Teknis & Komparasi Open-Source',
    titleEn: 'Technical Research & Open-Source Comparison',
    phase: '02 · Riset Teknis',
    summaryId: 'Evaluasi jalur eksekusi Wine WoW64 + Box64 vs Box86 vs FEX-Emu ARM64EC, verifikasi lisensi, serta batas Android.',
    summaryEn: 'Evaluation of Wine WoW64 + Box64 vs Box86 vs FEX-Emu ARM64EC, license verification, and Android execution constraints.',
    contentId: `# TECHNICAL_RESEARCH.md — Riset Teknis Eksekusi Windows di Android

## 1. Klarifikasi Jalur Eksekusi x86 & x64 (Fakta Terverifikasi)
- **[Terverifikasi]** **Box64 / Box86 tidak mengeksekusi berkas PE Windows (.exe/.dll) secara langsung.** Box64 menerjemahkan biner Linux userspace x86_64 ke ARM64. Wine-lah yang memuat PE Windows dan memetakan Win32/Win64 API ke syscall POSIX.
- **[Terverifikasi]** Perangkat Android ARMv9 generasi terbaru banyak meniadakan ABI kernel ARM32 sehingga dukungan **Box86** (yang membutuhkan host 32-bit) makin terbatas.
- **[Terverifikasi]** **Wine 9.x+ New WoW64** memungkinkan proses 64-bit tunggal di host ARM64 untuk menjalankan aplikasi Windows **x64 sekaligus x86 (32-bit)** melalui lapisan thunk WoW64, sehingga cukup dipasangkan dengan **Box64**.
- **[Perlu pengujian]** **FEX-Emu + Wine ARM64EC** memungkinkan Wine sendiri berjalan native ARM64 dan hanya menerjemahkan modul x86/x64 PE; layak disiapkan sebagai backend alternatif tahap lanjut.

## 2. Ringkasan Lisensi Open-Source
| Komponen | Peran | Lisensi | Catatan Distribusi |
| :--- | :--- | :--- | :--- |
| Wine WoW64 | Windows API Layer | LGPL-2.1+ | Perubahan pada Wine wajib terbuka |
| Box64 | Dynarec x86_64 → ARM64 | MIT | Permisif untuk bundel komersial/OSS |
| DXVK | D3D9/10/11 → Vulkan | zlib | Permisif dengan atribusi |
| VKD3D-Proton | D3D12 → Vulkan | LGPL-2.1 | Butuh Vulkan 1.3 lengkap |
| Mesa Turnip | Driver Vulkan Adreno | MIT / Khronos | Khusus GPU Qualcomm Adreno |
| PRoot | Rootless container | GPL-2.0+ | Alternatif Bionic-glibc mengurangi ptrace |

## 3. Batasan Teknis Jujur
- **[Terverifikasi]** Aplikasi Windows dengan driver anti-cheat tingkat kernel atau DRM hardware tidak akan berjalan.
- **[Perlu pengujian]** Stabilitas grafis Vulkan pada GPU non-Adreno (Mali, PowerVR) bergantung pada driver OEM perangkat.`,
    contentEn: `# TECHNICAL_RESEARCH.md — Windows on Android Technical Research

## 1. Execution Chain Verification
- **[Verified]** **Box64 / Box86 never execute Windows PE (.exe/.dll) binaries directly.** Box64 translates x86_64 Linux userspace binaries to ARM64; Wine loads Windows PE executables and translates Win32/Win64 APIs into POSIX calls.
- **[Verified]** Modern ARMv9 Android SoCs increasingly drop 32-bit ARM kernel ABI execution, making legacy **Box86** impractical on newer phones.
- **[Verified]** **Wine 9.x+ New WoW64** runs both 32-bit (x86) and 64-bit (x64) Windows executables inside a unified 64-bit host runtime paired with **Box64**.
- **[Needs testing]** **FEX-Emu + Wine ARM64EC** keeps Wine native ARM64 while translating only x86/x64 PE code; tracked as an experimental backend option.

## 2. Open-Source License Matrix
Wine (LGPL-2.1+), Box64 (MIT), DXVK (zlib), VKD3D-Proton (LGPL-2.1), Mesa Turnip (MIT/Khronos), PRoot (GPL-2.0+). Copyleft obligations on Wine/VKD3D-Proton require publishing modifications to those respective libraries.`,
  },
  {
    id: 'architecture',
    filename: 'ARCHITECTURE.md',
    titleId: 'Arsitektur Sistem Modular',
    titleEn: 'Modular System Architecture',
    phase: '03 · Arsitektur Sistem',
    summaryId: 'Gambaran arsitektur berlapis antara UI Android (Kotlin/Compose), Core Orchestrator, JNI Bridge, dan Runtime Userspace.',
    summaryEn: 'Layered architecture separating Android UI (Kotlin/Compose), Core Orchestrator, JNI Bridge, and Userspace Runtime.',
    contentId: `# ARCHITECTURE.md — Arsitektur Sistem WPhone

\`\`\`text
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
\`\`\`

## Prinsip Pemisahan
1. **Shared Runtime (Read-Only)**: Komponen biner Wine, Box64, DXVK, dan Turnip dipasang terpusat di \`/WPhone/runtime\`.
2. **Isolated Prefix (Read-Write)**: Setiap aplikasi menulis registry dan berkas sistem ke \`/WPhone/prefixes/<app-id>\`.
3. **Zero Silent Degradation**: Setiap kegagalan komponen menghasilkan log diagnostik terstruktur dan saran pemecahan masalah.`,
    contentEn: `# ARCHITECTURE.md — WPhone System Architecture

Layered separation isolates Kotlin/Jetpack Compose UI from domain orchestration, NDK native display/audio/input bridges, and the PRoot/glibc userspace hosting Box64 + Wine WoW64 + DXVK/Turnip.`,
  },
  {
    id: 'modules',
    filename: 'MODULES.md',
    titleId: 'Daftar & Tanggung Jawab Modul',
    titleEn: 'Module Catalog & Responsibilities',
    phase: '03 · Arsitektur Sistem',
    summaryId: 'Batasan tanggung jawab dan kontrak antarmuka tiap modul dari UI hingga Diagnostics.',
    summaryEn: 'Clear boundaries and API contracts across all 17 WPhone functional modules.',
    contentId: `# MODULES.md — Pemetaan Modul WPhone

1. **\`ui-android\`**: Layar Compose (Wizard, Library, Admin Panel, Keyboard Overlay).
2. **\`app-library\`**: Katalog aplikasi terdaftar, pencarian, filter kategori, dan metadata shortcut.
3. **\`app-installer\`**: Orkestrator 4 alur masuk aplikasi (installer \`.exe/.msi\`, impor direktori, shortcut, konfigurasi).
4. **\`app-launcher\`**: Menyusun environment variables, argumen Box64/Wine, dan memulai sesi proses.
5. **\`runtime-manager\`**: Mengunduh, memverifikasi SHA-256, memasang, dan memvalidasi versi komponen runtime.
6. **\`compat-wine\`**: Antarmuka ke \`wine\`, \`wineserver\`, dan \`wineboot\`.
7. **\`cpu-translator\`**: Manajemen profil \`BOX64_DYNAREC_*\` dan validasi arsitektur host.
8. **\`graphics-subsystem\`**: Seleksi Mesa Turnip, System Vulkan, DXVK, VKD3D-Proton, dan VirGL/WineD3D.
9. **\`audio-subsystem\`**: Manajemen daemon PulseAudio dan bridge Android AAudio.
10. **\`input-keyboard\`**: Pemetaan Gaming Pad & Desktop Modifier Bar ke event input.
11. **\`prefix-manager\`**: Pembuatan, kloning, perbaikan, dan pembersihan \`WINEPREFIX\`.
12. **\`dependency-manager\`**: Pelacakan paket seperti \`vcrun2022\`, \`d3dcompiler_47\`, dan \`corefonts\`.
13. **\`plugin-host\`**: Loader arsip \`.wrplugin\`, verifikasi izin, dan bridge JS/Python/Java.
14. **\`file-manager\`**: Operasi berkas aman dengan proteksi direktori inti sistem.
15. **\`diagnostics\`**: Pengumpul log runtime, crash trace, dan pengekspor laporan pemecahan masalah.
16. **\`config-store\`**: Penggabungan konfigurasi global dan per-aplikasi.
17. **\`localization-helper\`**: Kamus multibahasa (ID/EN) serta basis pengetahuan bantuan kontekstual.`,
    contentEn: `# MODULES.md — WPhone Module Breakdown

Defines 17 focused modules with minimal coupling: \`ui-android\`, \`app-library\`, \`app-installer\`, \`app-launcher\`, \`runtime-manager\`, \`compat-wine\`, \`cpu-translator\`, \`graphics-subsystem\`, \`audio-subsystem\`, \`input-keyboard\`, \`prefix-manager\`, \`dependency-manager\`, \`plugin-host\`, \`file-manager\`, \`diagnostics\`, \`config-store\`, and \`localization-helper\`.`,
  },
  {
    id: 'runtime-design',
    filename: 'RUNTIME_DESIGN.md',
    titleId: 'Desain Runtime & Siklus Hidup Proses',
    titleEn: 'Runtime Design & Process Lifecycle',
    phase: '03 · Arsitektur Sistem',
    summaryId: 'Alur penyediaan runtime pertama kali, pemulihan unduhan terputus, serta siklus hidup start/stop sesi Wine.',
    summaryEn: 'Initial runtime provisioning, interrupted download recovery, and Wine session start/stop lifecycle.',
    contentId: `# RUNTIME_DESIGN.md — Desain Runtime WPhone

## Siklus Inisialisasi Pertama Kali
1. **Device Probe**: Membaca \`Build.SUPPORTED_ABIS\`, total/free RAM, ruang penyimpanan, nama GPU (\`EGL_RENDERER\`), dan dukungan ekstensi Vulkan.
2. **Rekomendasi Profil**:
   - **Light**: Wine WoW64 + Box64 + PRoot Glibc + AAudio Bridge (~319 MB).
   - **Medium**: Light + DXVK + pustaka dependensi inti (~361 MB).
   - **Advanced**: Medium + Mesa Turnip (bila Adreno) + VKD3D-Proton (~444 MB).
3. **Resumable Provisioning**: Setiap artefak diunduh dengan *range resume* dan diverifikasi SHA-256 sebelum ekstraksi ke \`/WPhone/runtime\`.

## Siklus Peluncuran Aplikasi
1. Validasi keberadaan komponen runtime yang dipilih konfigurasi aplikasi.
2. Pastikan PulseAudio → AAudio sink aktif dan Display Surface siap.
3. Suntikkan \`WINEPREFIX=/WPhone/prefixes/<id>\` dan variabel \`BOX64_*\` / \`DXVK_*\`.
4. Eksekusi \`box64 wine64 <app.exe> [args]\`.
5. Saat pengguna menekan hentikan proses, kirim \`wineserver -k\` secara halus sebelum terminasi paksa.`,
    contentEn: `# RUNTIME_DESIGN.md — WPhone Runtime Lifecycle

Covers device hardware probing, Light/Medium/Advanced profile sizing, resumable SHA-256 verified downloads, and clean \`wineserver -k\` shutdown orchestration.`,
  },
  {
    id: 'prefix-management',
    filename: 'PREFIX_MANAGEMENT.md',
    titleId: 'Pengelolaan Wine Prefix Per Aplikasi',
    titleEn: 'Per-App Wine Prefix Management',
    phase: '03 · Arsitektur Sistem',
    summaryId: 'Struktur direktori prefix terisolasi, berbagi runtime global, dan batasan keamanan prefix.',
    summaryEn: 'Isolated prefix directory layout, shared global runtime mounting, and security boundaries.',
    contentId: `# PREFIX_MANAGEMENT.md — Isolasi Prefix Per Aplikasi

## Mengapa Prefix Dipisah?
Dua aplikasi Windows sering membutuhkan versi Visual C++ Runtime, overrides \`d3d9/dxgi\`, atau pengaturan versi Windows (\`win7\` vs \`win10\`) yang bertentangan. Memisahkan \`WINEPREFIX\` per aplikasi menjaga stabilitas seluruh library.

## Struktur Penyimpanan
\`\`\`text
/WPhone/
  ├── runtime/                  # Read-only bersama untuk semua aplikasi
  ├── prefixes/
  │    ├── pfx-notepadpp/       # drive_c, system.reg, user.reg khusus Notepad++
  │    └── pfx-hollowknight/    # drive_c, shader cache, dxvk.conf khusus Hollow Knight
  └── imports/                  # Berkas aplikasi portabel & installer pengguna
\`\`\`

> **Penting**: Wine prefix adalah batas isolasi konfigurasi dan dependensi, **bukan** sandbox keamanan sistem operasi.`,
    contentEn: `# PREFIX_MANAGEMENT.md — Per-App Wine Prefix Isolation

Separating \`WINEPREFIX\` per registered app prevents DLL override and registry conflicts while mounting \`/WPhone/runtime\` read-only to save storage. Note: Wine prefixes are configuration boundaries, not security sandboxes.`,
  },
  {
    id: 'plugin-spec',
    filename: 'PLUGIN_SPEC.md',
    titleId: 'Spesifikasi Sistem Plugin (.wrplugin)',
    titleEn: 'Modular Plugin Specification (.wrplugin)',
    phase: '04 · Ekstensibilitas',
    summaryId: 'Struktur paket ZIP .wrplugin, skema manifest plugin.json/plugin.toml, bridge JS/Python/Java, dan kontrol izin.',
    summaryEn: '.wrplugin ZIP package format, plugin.json/toml manifest schema, JS/Python/Java bridges, and permission controls.',
    contentId: `# PLUGIN_SPEC.md — Arsitektur Plugin WPhone

## Format Paket \`.wrplugin\`
Arsip ZIP terverifikasi dengan manifest wajib di direktori root: \`plugin.json\` atau \`plugin.toml\`.

\`\`\`json
{
  "id": "org.community.turnip-presets",
  "name": "Turnip Driver & DXVK Presets",
  "version": "1.2.0",
  "category": "backend",
  "author": "WPhone Community",
  "description": "Menambahkan profil konfigurasi Turnip dan DXVK teruji.",
  "icon": "assets/icon.png",
  "readme": "README.md",
  "entry": "main.js",
  "language": "javascript",
  "apiVersion": "1.0",
  "dependencies": [],
  "permissions": ["runtime.env.write", "graphics.profile.register"],
  "compatibility": { "minWPhone": "1.0.0", "arch": ["arm64-v8a"] }
}
\`\`\`

## Bahasa & Namespace API
- Mendukung **JavaScript**, **Python**, dan **Java** melalui *language bridge* resmi tanpa mengonversi kode sumber antarbahasa.
- Interpreter Python/JS bersifat opsional/on-demand agar APK awal tetap kecil.
- Namespace terkontrol: \`wphone.frontend\` (tema, komponen UI, halaman, layout keyboard) dan \`wphone.backend\` (komponen runtime, konfigurasi grafis/audio, dependensi).
- Setiap plugin backend dengan hak istimewa wajib melewati validasi integritas, peninjauan izin oleh pengguna, dan peringatan eksplisit.`,
    contentEn: `# PLUGIN_SPEC.md — .wrplugin Architecture

Defines the ZIP-based \`.wrplugin\` archive with root \`plugin.json\`/\`plugin.toml\`, controlled \`wphone.frontend\` and \`wphone.backend\` APIs, optional JS/Python/Java execution bridges, and explicit user permission review.`,
  },
  {
    id: 'keyboard-spec',
    filename: 'KEYBOARD_SPEC.md',
    titleId: 'Spesifikasi Sistem Dual Keyboard',
    titleEn: 'Dual Keyboard System Specification',
    phase: '04 · UX & Input',
    summaryId: 'Desain Gaming Keyboard (kontrol sentuh seperti JoiPlay) dan Desktop/Application Keyboard (IME Android + baris tombol PC).',
    summaryEn: 'Design of Gaming Keyboard (touch pad controls) and Desktop/Application Keyboard (Android IME + PC modifier bar).',
    contentId: `# KEYBOARD_SPEC.md — Sistem Dual Keyboard WPhone

## A. Gaming Keyboard
Terinspirasi oleh kontrol sentuh seperti JoiPlay, dengan editor posisi, ukuran, transparansi, dan preset per aplikasi:
- D-Pad 8 arah & Virtual Analog Stick.
- Tombol A / B / X / Y, L1 / R1 / L2 / R2, Start, dan Select.
- Tombol makro tambahan yang dapat dipetakan ulang ke kombinasi tombol keyboard/gamepad.

## B. Desktop / Application Keyboard
Dirancang untuk aplikasi produktivitas dan utilitas Windows:
- Menggunakan **IME/Keyboard Android native** untuk input teks utama.
- Menambahkan baris tombol *modifier* dan tombol desktop yang hilang di keyboard ponsel: \`ESC\`, \`TAB\`, \`CTRL\`, \`ALT\`, \`SHIFT\`, \`META\`, \`F1–F12\`, tombol panah, \`HOME\`, \`END\`, \`PAGE UP\`, \`PAGE DOWN\`, \`INSERT\`, \`DELETE\`.
- Mendukung mode *sticky modifier* (ketuk CTRL sekali untuk kombinasi berikutnya) serta dukungan keyboard fisik eksternal.
- Perpindahan instan antara Gaming ↔ Desktop saat aplikasi berjalan.`,
    contentEn: `# KEYBOARD_SPEC.md — Dual Keyboard Architecture

Combines a customizable touch Gaming Pad (D-pad, virtual analog, A/B/X/Y, Start/Select, per-app presets) with a Desktop/Application bar pairing Android IME text input with sticky PC modifiers (\`CTRL\`, \`ALT\`, \`SHIFT\`, \`ESC\`, \`TAB\`, \`F1–F12\`, navigation keys) and instant runtime switching.`,
  },
  {
    id: 'ui-ux-spec',
    filename: 'UI_UX_SPEC.md',
    titleId: 'Spesifikasi Antarmuka & Pengalaman Pengguna',
    titleEn: 'UI / UX Design Specification',
    phase: '04 · UX & Desain',
    summaryId: 'Hierarki layar Android modern, identitas visual WPhone, sistem tema Light/Dark, dan aturan tata letak bebas-clutter.',
    summaryEn: 'Modern Android screen hierarchy, WPhone visual identity, Light/Dark theming, and clutter-free layout rules.',
    contentId: `# UI_UX_SPEC.md — Desain Antarmuka WPhone

- **Inspirasi Fungsional**: Kesederhanaan library JoiPlay + kedalaman opsi runtime ala Winlator, dikemas dalam identitas visual WPhone sendiri (bukan kloning antarmuka).
- **Admin Panel Native**: Didesain sebagai konsol sistem Android modern — **bukan** desktop Windows virtual dengan Start Menu atau Taskbar.
- **Hierarki Layar**:
  1. First-Time Setup Wizard (muncul sekali saat belum terinisialisasi).
  2. App Library (layar beranda default setelah setup selesai).
  3. App Launch Session (layar penuh dengan overlay keyboard & panel hentikan proses aman).
  4. Admin Panel (Dashboard, File Manager, App Manager, Runtime Manager, Logs & Diagnostics).
  5. Helper & Settings (dukungan ID/EN + perbaikan konfigurasi).
- **Aksesibilitas & Ergonomi**: Target sentuh minimal 44×44px, kontras WCAG AA di Light maupun Dark mode, serta angka tabular untuk seluruh ukuran berkas, penggunaan RAM, dan timestamp log.`,
    contentEn: `# UI_UX_SPEC.md — UI & UX Guidelines

Synthesizes JoiPlay-like library simplicity with Winlator-inspired runtime configurability inside an original WPhone Android design system—supporting dual Light/Dark themes, 44px minimum touch targets, and tabular telemetry numerals.`,
  },
  {
    id: 'security',
    filename: 'SECURITY.md',
    titleId: 'Model Keamanan & Integritas',
    titleEn: 'Security & Integrity Model',
    phase: '03 · Keamanan',
    summaryId: 'Verifikasi hash komponen runtime, proteksi operasi berkas, keamanan plugin .wrplugin, dan batas isolasi prefix.',
    summaryEn: 'Runtime SHA-256 verification, protected filesystem guards, .wrplugin permission model, and prefix boundaries.',
    contentId: `# SECURITY.md — Keamanan & Integritas WPhone

1. **Integritas Runtime**: Seluruh unduhan Wine, Box64, DXVK, dan Turnip wajib melalui verifikasi checksum SHA-256 sebelum diekstrak ke direktori \`runtime\` yang dilindungi.
2. **Batas Prefix**: Wine prefix hanya mengisolasi registry dan berkas konfigurasi aplikasi Windows — **bukan** sandbox keamanan OS. Berkas Windows yang tidak tepercaya tetap berisiko mengakses direktori yang dipetakan (\`Z:\\\` atau folder impor).
3. **Proteksi File Manager**: Direktori inti \`/WPhone/runtime\` dan \`/WPhone/config\` dilindungi terhadap penghapusan tidak sengaja.
4. **Kontrol Plugin**: Setiap paket \`.wrplugin\` harus mendeklarasikan izin eksplisit di manifest. Plugin frontend dibatasi ke API UI terkontrol; plugin backend yang menyentuh environment runtime menampilkan peringatan hak istimewa sebelum aktivasi.`,
    contentEn: `# SECURITY.md — WPhone Security Model

Enforces SHA-256 verification for runtime downloads, protected system paths in File Manager, explicit permission review for \`.wrplugin\` packages, and transparent warnings that Wine prefixes are configuration boundaries rather than OS security sandboxes.`,
  },
  {
    id: 'roadmap',
    filename: 'ROADMAP.md',
    titleId: 'Roadmap Pengembangan Bertahap',
    titleEn: 'Phased Development Roadmap',
    phase: '05 · Rencana Kerja',
    summaryId: 'Rencana bertahap dari riset & prototipe UI (Fase 1–5) menuju integrasi NDK Android, pengujian perangkat nyata, dan rilis.',
    summaryEn: 'Incremental phases from research & UI prototyping (Phases 1–5) to Android NDK integration, hardware validation, and release.',
    contentId: `# ROADMAP.md — Tahapan Pengembangan WPhone

- **Fase 1–4 (Selesai pada Dokumen & Prototipe)**: Analisis kebutuhan, riset lisensi & Wine WoW64 + Box64, arsitektur modular 17 modul, spesifikasi UX/UI, dan prototipe web interaktif.
- **Fase 5 — Prototipe Native Risiko Tinggi**: Uji eksekusi headless \`box64 wine64\` + PulseAudio→AAudio + SurfaceView pada perangkat Android ARM64 fisik (Adreno & Mali).
- **Fase 6 — Implementasi Bertahap Android**: Bangun modul satu per satu (\`config-store\` → \`runtime-manager\` → \`prefix-manager\` → \`app-library\` → \`admin-panel\` → \`input-keyboard\` → \`plugin-host\`).
- **Fase 7 — Pengujian Lintas Perangkat**: Uji jalur x86/x64 WoW64, isolasi prefix, skenario crash/recovery, dan profil baterai/termal.
- **Fase 8 — Persiapan Rilis**: Build APK/AAB modular (opsi unduhan runtime on-demand), dokumentasi kepatuhan lisensi LGPL/MIT/zlib, dan prosedur migrasi prefix.`,
    contentEn: `# ROADMAP.md — Phased Delivery Roadmap

Tracks execution from Phases 1–4 (completed specs & interactive web prototype) through Phase 5 high-risk native NDK prototyping (headless Box64+Wine WoW64, AAudio, Vulkan/Turnip) and incremental Android module implementation.`,
  },
  {
    id: 'decisions',
    filename: 'DECISIONS.md',
    titleId: 'Catatan Keputusan Arsitektur (ADR)',
    titleEn: 'Architecture Decision Records (ADR)',
    phase: '06 · Tata Kelola',
    summaryId: 'Rekaman keputusan kunci beserta alasan, risiko, dan alternatif yang dipertimbangkan.',
    summaryEn: 'Recorded architectural decisions, rationale, risks, and alternatives evaluated.',
    contentId: `# DECISIONS.md — Catatan Keputusan Arsitektur

## ADR-001: Memilih Wine WoW64 + Box64 sebagai Baseline x86 & x64
- **Keputusan**: Memprioritaskan Wine WoW64 + Box64 daripada bundel terpisah Box86 + Box64.
- **Alasan**: Menghilangkan ketergantungan pada rootfs 32-bit dan kernel ARM32 ABI yang makin jarang tersedia pada Android modern.
- **Risiko**: Beberapa aplikasi Windows 32-bit legacy tertentu perlu pengujian kompatibilitas di mode WoW64.

## ADR-002: Satu Sistem Terkelola + Prefix Terisolasi Per Aplikasi
- **Keputusan**: Runtime global dibagi secara *read-only*, sementara \`WINEPREFIX\` dipisah per aplikasi.
- **Alasan**: Menghemat ratusan MB penyimpanan dibanding menggandakan runtime per wadah, sambil tetap mencegah bentrok registry/DLL.

## ADR-003: Admin Panel Native Android (Bukan Desktop Shell Windows)
- **Keputusan**: Manajemen sistem dilakukan lewat GUI native Android yang bersih (Dashboard, File, App, Runtime, Logs).
- **Alasan**: Lebih ergonomis untuk layar sentuh ponsel, ringan, dan selaras dengan prinsip kesederhanaan WPhone.

## ADR-004: Format Plugin ZIP \`.wrplugin\` dengan Manifest Root
- **Keputusan**: Menggunakan arsip ZIP ber-ekstensi \`.wrplugin\` berisi \`plugin.json\` atau \`plugin.toml\`.
- **Alasan**: Mudah divalidasi integritasnya, tidak memerlukan compiler saat instalasi, dan mendukung bridge multi-bahasa.`,
    contentEn: `# DECISIONS.md — Architecture Decision Records

Documents ADR-001 (Wine WoW64 + Box64 baseline), ADR-002 (Single managed system + per-app isolated Wine prefix), ADR-003 (Native Android Admin Panel over virtual Windows desktop shell), and ADR-004 (\`.wrplugin\` ZIP archive with root manifest).`,
  },
];
