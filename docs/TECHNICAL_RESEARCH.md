# TECHNICAL_RESEARCH.md — Riset Teknis Eksekusi Windows di Android

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
- **[Perlu pengujian]** Stabilitas grafis Vulkan pada GPU non-Adreno (Mali, PowerVR) bergantung pada driver OEM perangkat.
