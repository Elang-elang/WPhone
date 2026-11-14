import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck, Keyboard, Puzzle } from 'lucide-react';
import { ResolvedLanguage, VerificationStatus } from '../types/wphone';
import { COMPATIBILITY_MATRIX } from '../data/mockData';
import { SAMPLE_PLUGIN_MANIFEST } from '../data/helperData';
import { translations, verificationLabel } from '../i18n/translations';

interface CompatibilityViewProps {
  lang: ResolvedLanguage;
}

const renderVerificationText = (status: VerificationStatus, lang: ResolvedLanguage) => {
  const label = verificationLabel(status, lang);
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'likely') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0078D4] dark:text-sky-400">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

export const CompatibilityView: React.FC<CompatibilityViewProps> = ({ lang }) => {
  const t = translations[lang].compatibility;
  const [subTab, setSubTab] = useState<'stack' | 'plugin' | 'keyboard'>('stack');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {t.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Interactive Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('stack')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'stack'
              ? 'bg-[#0078D4] text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {t.stackTab}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('plugin')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'plugin'
              ? 'bg-[#0078D4] text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Puzzle className="w-3.5 h-3.5" />
          <span>{t.pluginTab}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('keyboard')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'keyboard'
              ? 'bg-[#0078D4] text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>{t.keyboardTab}</span>
        </button>
      </div>

      {/* TAB 1: OPEN-SOURCE MATRIX */}
      {subTab === 'stack' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {t.colComponent}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {t.colLicense}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {t.colMaintenance}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {t.colStatus}
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    {t.colConstraints}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {COMPATIBILITY_MATRIX.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5 min-w-[220px]">
                      <div className="font-display font-bold text-slate-900 dark:text-white text-sm">
                        {item.component}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                        {lang === 'id' ? item.roleId : item.roleEn}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 mt-1">
                        {item.repository} · {item.hostArch}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {item.license}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.maintenance}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderVerificationText(item.verification, lang)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 leading-relaxed min-w-[260px]">
                      {lang === 'id' ? item.constraintsId : item.constraintsEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {lang === 'id'
                ? 'Catatan Kejujuran Teknis (Bagian 4 & 17): Box64 dan Box86 tidak mengeksekusi berkas Windows .exe secara langsung. Keduanya menerjemahkan biner Linux userspace x86_64/x86 ke ARM64 agar Wine dapat memuat Windows PE dan memanggil API grafis Vulkan melalui DXVK/VKD3D.'
                : 'Technical Honesty Note (Sections 4 & 17): Box64 and Box86 never execute Windows .exe PE files directly. They translate Linux userspace x86_64/x86 binaries hosting Wine, which in turn loads Windows PE executables and routes DirectX via DXVK/VKD3D to Vulkan.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: .WRPLUGIN ARCHITECTURE */}
      {subTab === 'plugin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-sm">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {lang === 'id' ? 'Skema Paket .wrplugin & Keamanan' : '.wrplugin Package Schema & Security'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'id'
                ? 'Paket plugin berupa arsip ZIP berekstensi .wrplugin dengan manifest plugin.json atau plugin.toml di direktori root. Mendukung bridge JavaScript, Python, dan Java tanpa mengonversi kode sumber antarbahasa.'
                : 'Plugins are ZIP archives using the .wrplugin extension with a root plugin.json or plugin.toml manifest. Supports JavaScript, Python, and Java language bridges without transpiling source code between languages.'}
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Namespace: wphone.frontend
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  {lang === 'id'
                    ? 'Tema, palet warna, komponen UI terkontrol, halaman tambahan, dialog, dan preset layout keyboard.'
                    : 'Themes, color palettes, controlled UI widgets, custom pages, dialogs, and keyboard layout presets.'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Namespace: wphone.backend
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  {lang === 'id'
                    ? 'Pendaftaran komponen runtime, profil grafis/audio alternatif, dan paket dependensi — memerlukan tinjauan izin eksplisit & verifikasi integritas.'
                    : 'Runtime component registration, alternative graphics/audio profiles, and dependency packs — requires explicit permission review & integrity verification.'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-5 text-slate-100 space-y-2">
            <div className="font-mono text-xs text-sky-400">plugin.json (Root Archive Manifest)</div>
            <pre className="font-mono text-xs overflow-x-auto leading-relaxed text-slate-200">
              {SAMPLE_PLUGIN_MANIFEST}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: DUAL KEYBOARD SPEC */}
      {subTab === 'keyboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs sm:text-sm">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              A. Gaming Keyboard (JoiPlay-Inspired)
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>D-Pad, Virtual Analog Stick, A / B / X / Y, Start & Select, L/R shoulder keys.</li>
              <li>
                {lang === 'id'
                  ? 'Editor posisi, ukuran tombol, transparansi overlay, serta pemetaan ulang tombol bebas.'
                  : 'Customizable key position, button sizing, overlay opacity, and arbitrary key remapping.'}
              </li>
              <li>
                {lang === 'id'
                  ? 'Disimpan sebagai preset per aplikasi untuk game Windows maupun visual novel.'
                  : 'Stored as per-app presets for Windows games and controller-driven apps.'}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs sm:text-sm">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              B. Desktop / Application Keyboard
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>
                {lang === 'id'
                  ? 'Keyboard Android (IME) tetap menjadi metode input teks utama.'
                  : 'Native Android IME remains the primary text input method.'}
              </li>
              <li>
                {lang === 'id'
                  ? 'Menambahkan baris tombol desktop: SHIFT, CTRL, ALT, ESC, META, TAB, F1–F12, Panah, HOME, END, PAGE UP/DOWN, INSERT, DELETE.'
                  : 'Adds a customizable PC bar: SHIFT, CTRL, ALT, ESC, META, TAB, F1–F12, Arrows, HOME, END, PAGE UP/DOWN, INSERT, DELETE.'}
              </li>
              <li>
                {lang === 'id'
                  ? 'Mendukung sticky modifier, keyboard fisik Bluetooth/USB, dan pergantian layout langsung saat aplikasi berjalan.'
                  : 'Supports sticky modifiers, physical Bluetooth/USB keyboards, and live layout switching during runtime.'}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
