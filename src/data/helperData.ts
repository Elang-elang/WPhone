export interface HelperArticle {
  id: string;
  topicId: string;
  topicEn: string;
  summaryId: string;
  summaryEn: string;
  pointsId: string[];
  pointsEn: string[];
}

export const HELPER_ARTICLES: HelperArticle[] = [
  {
    id: 'runtime-components',
    topicId: 'Komponen Runtime & Jalur Eksekusi',
    topicEn: 'Runtime Components & Execution Path',
    summaryId:
      'Memahami bagaimana Wine WoW64, Box64, DXVK, dan Mesa Turnip bekerja bersama tanpa memasang OS Windows penuh.',
    summaryEn:
      'Understand how Wine WoW64, Box64, DXVK, and Mesa Turnip work together without installing a full Windows OS.',
    pointsId: [
      'Box64 menerjemahkan biner Linux userspace x86_64 ke ARM64 — Box64 tidak mengeksekusi .exe Windows secara langsung.',
      'Wine WoW64 memuat berkas PE Windows (x86 32-bit dan x64 64-bit) dan memetakan panggilan Win32/Win64 ke POSIX.',
      'DXVK dan VKD3D-Proton menerjemahkan DirectX ke Vulkan agar akselerasi GPU berjalan.',
      'Mesa Turnip mempercepat Vulkan khusus GPU Qualcomm Adreno; perangkat Mali/lainnya memakai System Vulkan atau VirGL.',
    ],
    pointsEn: [
      'Box64 translates x86_64 Linux userspace binaries to ARM64 — it never runs Windows .exe PE binaries directly.',
      'Wine WoW64 loads both 32-bit x86 and 64-bit x64 Windows PE binaries and maps Win32/Win64 APIs to POSIX.',
      'DXVK and VKD3D-Proton translate DirectX graphics calls to Vulkan for hardware GPU acceleration.',
      'Mesa Turnip targets Qualcomm Adreno GPUs; Mali or other GPUs should use System Vulkan or VirGL/WineD3D.',
    ],
  },
  {
    id: 'install-profiles',
    topicId: 'Opsi Instalasi Awal (Light, Medium, Advanced)',
    topicEn: 'Initial Setup Profiles (Light, Medium, Advanced)',
    summaryId:
      'Cara memilih profil yang sesuai kapasitas RAM, ruang penyimpanan, dan GPU perangkat Android Anda.',
    summaryEn:
      'How to pick the right profile for your Android device RAM, available storage, and GPU driver support.',
    pointsId: [
      'Light (~319 MB): Hanya Wine WoW64, Box64, PRoot glibc, dan AAudio bridge. Cocok untuk RAM <= 4 GB atau utilitas teks/arsip.',
      'Medium (~361 MB): Menambah DXVK untuk aplikasi produktivitas dan game DirectX 9–11.',
      'Advanced (~444 MB): Menambah Turnip (bila Adreno) dan VKD3D-Proton untuk DirectX 12 pada perangkat kelas atas.',
    ],
    pointsEn: [
      'Light (~319 MB): Core Wine WoW64, Box64, PRoot glibc, and AAudio bridge. Best for <= 4 GB RAM or text/archive tools.',
      'Medium (~361 MB): Adds DXVK for productivity apps and DirectX 9–11 workloads.',
      'Advanced (~444 MB): Adds Mesa Turnip (on Adreno) and VKD3D-Proton for DirectX 12 on high-end devices.',
    ],
  },
  {
    id: 'prefix-isolation',
    topicId: 'Konfigurasi Per Aplikasi & Isolasi Prefix',
    topicEn: 'Per-App Configuration & Prefix Isolation',
    summaryId:
      'Mengapa setiap aplikasi Windows memiliki direktori WINEPREFIX sendiri serta cara mengatasi konflik dependensi.',
    summaryEn:
      'Why each Windows application uses its own WINEPREFIX directory and how to avoid DLL or registry collisions.',
    pointsId: [
      'Setiap aplikasi menulis registry dan pustaka C++ ke folder /WPhone/prefixes/<app-id> miliknya sendiri.',
      'Runtime inti (/WPhone/runtime) dipakai bersama secara read-only sehingga hemat penyimpanan.',
      'Penting: Wine prefix bukan sandbox keamanan OS; jalankan hanya berkas .exe dari sumber tepercaya.',
    ],
    pointsEn: [
      'Each app writes its registry hives and Visual C++ overrides into its own /WPhone/prefixes/<app-id> folder.',
      'Core runtimes (/WPhone/runtime) are shared read-only to avoid duplicating hundreds of MB per app.',
      'Note: A Wine prefix is a configuration boundary, not an OS security sandbox. Only run trusted executables.',
    ],
  },
  {
    id: 'keyboard-modes',
    topicId: 'Sistem Dual Keyboard (Gaming & Desktop)',
    topicEn: 'Dual Keyboard System (Gaming & Desktop)',
    summaryId:
      'Berpindah antara tata letak kontroler sentuh dan baris tombol modifier desktop selama aplikasi berjalan.',
    summaryEn:
      'Switching seamlessly between touch controller overlays and desktop modifier keybars while an app is running.',
    pointsId: [
      'Gaming Keyboard menyediakan D-pad, analog virtual, tombol A/B/X/Y, Start/Select, serta transparansi yang dapat diatur.',
      'Desktop Keyboard memadukan keyboard teks Android dengan tombol CTRL, ALT, SHIFT, ESC, TAB, F1–F12, panah, HOME, END, dan DELETE.',
      'Setiap aplikasi menyimpan profil keyboard default masing-masing.',
    ],
    pointsEn: [
      'Gaming Keyboard provides customizable D-pad, virtual analog, A/B/X/Y, Start/Select, and opacity controls.',
      'Desktop Keyboard pairs native Android text input with CTRL, ALT, SHIFT, ESC, TAB, F1–F12, arrows, HOME, END, and DELETE.',
      'Every registered app stores its own default keyboard layout and preset.',
    ],
  },
  {
    id: 'plugin-permissions',
    topicId: 'Keamanan & Izin Plugin (.wrplugin)',
    topicEn: 'Plugin Security & Permissions (.wrplugin)',
    summaryId:
      'Memahami perbedaan plugin Frontend (UI/Tema) dan Backend (Runtime/Grafis) sebelum menyetujui izin.',
    summaryEn:
      'Understanding Frontend (UI/Theme) vs Backend (Runtime/Graphics) plugins before granting package permissions.',
    pointsId: [
      'Paket .wrplugin berformat ZIP dengan manifest plugin.json atau plugin.toml di direktori root.',
      'Plugin Frontend hanya mengakses API wphone.frontend untuk tema, navigasi, atau layout keyboard.',
      'Plugin Backend yang meminta izin wphone.backend dapat mengubah environment runtime; tinjau izin dan tanda tangan terlebih dahulu.',
    ],
    pointsEn: [
      '.wrplugin archives are ZIP packages containing a root plugin.json or plugin.toml manifest.',
      'Frontend plugins use controlled wphone.frontend APIs for themes, panels, or keyboard layouts.',
      'Backend plugins requesting wphone.backend privileges can alter runtime environments; always review permissions first.',
    ],
  },
  {
    id: 'troubleshooting',
    topicId: 'Pemecahan Masalah & Error Umum',
    topicEn: 'Common Errors & Troubleshooting',
    summaryId:
      'Langkah cepat mengatasi error DirectX, missing DLL, layar hitam, atau audio tersendat.',
    summaryEn:
      'Quick diagnostics for DirectX failures, missing DLLs, black screens, or crackling audio.',
    pointsId: [
      'Layar hitam pada GPU Mali: Ubah Graphics Backend aplikasi dari Turnip + DXVK ke System Vulkan atau WineD3D/VirGL.',
      'Error VCRUNTIME140.dll / MSVCP140.dll hilang: Pasang dependensi vcrun2022 pada prefix aplikasi melalui konfigurasi atau Dependency Manager.',
      'Instalasi runtime terputus: Gunakan tombol Resume/Recover pada Wizard atau Admin Panel tanpa mengulang paket yang sudah terverifikasi.',
      'Ekspor laporan diagnostik di tab Logs & Diagnostics sebelum melaporkan bug.',
    ],
    pointsEn: [
      'Black screen on Mali GPU: Switch the app Graphics Backend from Turnip + DXVK to System Vulkan or WineD3D/VirGL.',
      'Missing VCRUNTIME140.dll / MSVCP140.dll: Add vcrun2022 to the isolated app prefix via App Config.',
      'Interrupted runtime download: Use Recover & Resume in the Setup Wizard without re-downloading verified chunks.',
      'Export the diagnostic bundle in Admin Panel -> Logs & Diagnostics for detailed traces.',
    ],
  },
];

export const SAMPLE_PLUGIN_MANIFEST = `{
  "id": "id.wphone.turnip-optimizer",
  "name": "Adreno Turnip & DXVK Profile Pack",
  "version": "1.2.0",
  "category": "backend",
  "author": "WPhone Engineering",
  "description": "Menyediakan preset DXVK dan Mesa Turnip teruji untuk aplikasi produktivitas & game DirectX 11.",
  "icon": "assets/icon.png",
  "readme": "README.md",
  "mainScript": "src/index.js",
  "scriptLanguage": "javascript",
  "apiVersion": "wphone.backend@1.0",
  "dependencies": ["mesa-turnip>=24.0", "dxvk>=2.4"],
  "permissions": [
    "runtime.env.write",
    "graphics.profile.register"
  ],
  "compatibility": {
    "minWPhoneVersion": "1.0.0",
    "hostArch": ["arm64-v8a"],
    "gpuVendors": ["adreno"]
  }
}`;
