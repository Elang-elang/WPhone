# PREFIX_MANAGEMENT.md — Isolasi Prefix Per Aplikasi

## Mengapa Prefix Dipisah?
Dua aplikasi Windows sering membutuhkan versi Visual C++ Runtime, overrides `d3d9/dxgi`, atau pengaturan versi Windows (`win7` vs `win10`) yang bertentangan. Memisahkan `WINEPREFIX` per aplikasi menjaga stabilitas seluruh library.

## Struktur Penyimpanan
```text
/WPhone/
  ├── runtime/                  # Read-only bersama untuk semua aplikasi
  ├── prefixes/
  │    ├── pfx-notepadpp/       # drive_c, system.reg, user.reg khusus Notepad++
  │    └── pfx-hollowknight/    # drive_c, shader cache, dxvk.conf khusus Hollow Knight
  └── imports/                  # Berkas aplikasi portabel & installer pengguna
```

> **Penting**: Wine prefix adalah batas isolasi konfigurasi dan dependensi, **bukan** sandbox keamanan sistem operasi.
