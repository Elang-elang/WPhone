# PLUGIN_SPEC.md — Arsitektur Plugin WPhone

## Format Paket `.wrplugin`
Arsip ZIP terverifikasi dengan manifest wajib di direktori root: `plugin.json` atau `plugin.toml`.

```json
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
```

## Bahasa & Namespace API
- Mendukung **JavaScript**, **Python**, dan **Java** melalui *language bridge* resmi tanpa mengonversi kode sumber antarbahasa.
- Interpreter Python/JS bersifat opsional/on-demand agar APK awal tetap kecil.
- Namespace terkontrol: `wphone.frontend` (tema, komponen UI, halaman, layout keyboard) dan `wphone.backend` (komponen runtime, konfigurasi grafis/audio, dependensi).
- Setiap plugin backend dengan hak istimewa wajib melewati validasi integritas, peninjauan izin oleh pengguna, dan peringatan eksplisit.
