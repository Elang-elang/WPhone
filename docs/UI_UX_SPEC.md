# UI_UX_SPEC.md — Desain Antarmuka WPhone

- **Inspirasi Fungsional**: Kesederhanaan library JoiPlay + kedalaman opsi runtime ala Winlator, dikemas dalam identitas visual WPhone sendiri (bukan kloning antarmuka).
- **Admin Panel Native**: Didesain sebagai konsol sistem Android modern — **bukan** desktop Windows virtual dengan Start Menu atau Taskbar.
- **Hierarki Layar**:
  1. First-Time Setup Wizard (muncul sekali saat belum terinisialisasi).
  2. App Library (layar beranda default setelah setup selesai).
  3. App Launch Session (layar penuh dengan overlay keyboard & panel hentikan proses aman).
  4. Admin Panel (Dashboard, File Manager, App Manager, Runtime Manager, Logs & Diagnostics).
  5. Helper & Settings (dukungan ID/EN + perbaikan konfigurasi).
- **Aksesibilitas & Ergonomi**: Target sentuh minimal 44×44px, kontras WCAG AA di Light maupun Dark mode, serta angka tabular untuk seluruh ukuran berkas, penggunaan RAM, dan timestamp log.
