import React, { useState } from 'react';
import { Gamepad2, Keyboard, Plus, Save, Sliders } from 'lucide-react';
import { KeyboardPresetConfig, ResolvedLanguage } from '../types/wphone';

interface KeyboardStudioProps {
  presets: KeyboardPresetConfig[];
  lang: ResolvedLanguage;
  onSavePreset: (preset: KeyboardPresetConfig) => void;
}

const ALL_DESKTOP_KEYS = [
  'ESC',
  'TAB',
  'CTRL',
  'ALT',
  'SHIFT',
  'META',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F10',
  'F11',
  'F12',
  'HOME',
  'END',
  'PGUP',
  'PGDN',
  'INS',
  'DEL',
  '←',
  '↑',
  '↓',
  '→',
];

export const KeyboardStudio: React.FC<KeyboardStudioProps> = ({
  presets,
  lang,
  onSavePreset,
}) => {
  const [activeId, setActiveId] = useState(presets[0]?.id || 'preset-desktop-ide');
  const current = presets.find((p) => p.id === activeId) || presets[0];

  const [draft, setDraft] = useState<KeyboardPresetConfig>(() =>
    JSON.parse(JSON.stringify(current))
  );
  const [selectedControlId, setSelectedControlId] = useState<string>(
    current.gamingControls[0]?.id || ''
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSelectPreset = (id: string) => {
    const found = presets.find((p) => p.id === id);
    if (!found) return;
    setActiveId(id);
    setDraft(JSON.parse(JSON.stringify(found)));
    setSelectedControlId(found.gamingControls[0]?.id || '');
    setSavedNotice(false);
  };

  const handleCreatePreset = () => {
    const isGaming = draft.mode === 'gaming';
    const newPreset: KeyboardPresetConfig = {
      ...JSON.parse(JSON.stringify(draft)),
      id: `preset-${Date.now().toString(36)}`,
      name: isGaming ? 'Custom Gaming Layout' : 'Custom Desktop Bar',
    };
    onSavePreset(newPreset);
    setActiveId(newPreset.id);
    setDraft(newPreset);
  };

  const handleSave = () => {
    onSavePreset(draft);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const toggleDesktopKey = (key: string) => {
    setDraft((prev) => {
      const exists = prev.desktopKeys.includes(key);
      return {
        ...prev,
        desktopKeys: exists
          ? prev.desktopKeys.filter((k) => k !== key)
          : [...prev.desktopKeys, key],
      };
    });
  };

  const selectedControl = draft.gamingControls.find((c) => c.id === selectedControlId);

  const updateControl = (patch: Partial<NonNullable<typeof selectedControl>>) => {
    if (!selectedControl) return;
    setDraft((prev) => ({
      ...prev,
      gamingControls: prev.gamingControls.map((c) =>
        c.id === selectedControl.id ? { ...c, ...patch } : c
      ),
    }));
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {lang === 'id' ? 'Studio Kustomisasi Dual Keyboard' : 'Dual Keyboard Customizer Studio'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'id'
              ? 'Sesuaikan posisi kontrol Gaming Pad & baris tombol modifier Desktop per preset aplikasi.'
              : 'Customize Gaming Pad coordinates, opacity, key remapping, and Desktop modifier bars.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreatePreset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'id' ? 'Duplikasi Preset' : 'Duplicate Preset'}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {savedNotice
                ? lang === 'id'
                  ? 'Tersimpan'
                  : 'Saved'
                : lang === 'id'
                  ? 'Simpan Preset'
                  : 'Save Preset'}
            </span>
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSelectPreset(p.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeId === p.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {p.mode === 'gaming' ? (
              <Gamepad2 className="w-3.5 h-3.5" />
            ) : (
              <Keyboard className="w-3.5 h-3.5" />
            )}
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Editor Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {lang === 'id' ? 'Nama Preset' : 'Preset Name'}
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {lang === 'id' ? 'Transparansi Overlay' : 'Overlay Opacity'}: {draft.opacity}%
          </label>
          <input
            type="range"
            min={35}
            max={100}
            value={draft.opacity}
            onChange={(e) => setDraft({ ...draft, opacity: Number(e.target.value) })}
            className="w-full mt-2 accent-[#0078D4]"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.stickyModifiers}
              onChange={(e) => setDraft({ ...draft, stickyModifiers: e.target.checked })}
              className="accent-[#0078D4]"
            />
            <span>{lang === 'id' ? 'Aktifkan Sticky Modifier (CTRL/ALT)' : 'Enable Sticky Modifiers'}</span>
          </label>
        </div>
      </div>

      {/* Mode Specific Interactive Visual Editor */}
      {draft.mode === 'gaming' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Interactive Landscape Canvas */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 relative h-72 sm:h-80 overflow-hidden select-none">
            <div className="absolute top-3 left-3 text-[11px] font-mono text-slate-400">
              1280×720 Touch Overlay Canvas · Click any control to edit
            </div>
            {draft.gamingControls
              .filter((c) => c.visible)
              .map((ctrl) => (
                <button
                  key={ctrl.id}
                  type="button"
                  onClick={() => setSelectedControlId(ctrl.id)}
                  style={{
                    left: `${ctrl.xPercent}%`,
                    top: `${ctrl.yPercent}%`,
                    width: `${ctrl.sizePx}px`,
                    height: `${ctrl.sizePx}px`,
                    opacity: draft.opacity / 100,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`absolute rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-mono font-bold transition-colors ${
                    selectedControlId === ctrl.id
                      ? 'border-[#38BDF8] bg-[#0078D4]/40 text-white'
                      : 'border-slate-500 bg-slate-800/70 text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{ctrl.label}</span>
                  <span className="text-[9px] text-sky-300">{ctrl.mappedKey}</span>
                </button>
              ))}
          </div>

          {/* Control Inspector */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
            <div className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0078D4]" />
              <span>
                {selectedControl
                  ? `${lang === 'id' ? 'Edit Kontrol' : 'Edit Control'}: ${selectedControl.label}`
                  : lang === 'id'
                    ? 'Pilih tombol di kanvas'
                    : 'Select a button on canvas'}
              </span>
            </div>

            {selectedControl && (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-500 mb-1">Mapped Windows Key</label>
                  <input
                    type="text"
                    value={selectedControl.mappedKey}
                    onChange={(e) => updateControl({ mappedKey: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 tabular-nums">
                    X Position: {selectedControl.xPercent}%
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={selectedControl.xPercent}
                    onChange={(e) => updateControl({ xPercent: Number(e.target.value) })}
                    className="w-full accent-[#0078D4]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 tabular-nums">
                    Y Position: {selectedControl.yPercent}%
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={92}
                    value={selectedControl.yPercent}
                    onChange={(e) => updateControl({ yPercent: Number(e.target.value) })}
                    className="w-full accent-[#0078D4]"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 tabular-nums">
                    Size: {selectedControl.sizePx}px
                  </label>
                  <input
                    type="range"
                    min={36}
                    max={112}
                    value={selectedControl.sizePx}
                    onChange={(e) => updateControl({ sizePx: Number(e.target.value) })}
                    className="w-full accent-[#0078D4]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {lang === 'id'
              ? 'Pratinjau Baris Tombol Desktop (Aktif di atas Keyboard Android)'
              : 'Desktop Keybar Preview (Anchored Above Android Soft Keyboard)'}
          </div>

          <div
            className="p-3 rounded-xl bg-slate-950 flex flex-wrap gap-1.5"
            style={{ opacity: draft.opacity / 100 }}
          >
            {draft.desktopKeys.map((key) => (
              <span
                key={key}
                className="px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-white font-mono text-xs"
              >
                {key}
              </span>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'id'
                ? 'Aktifkan / Nonaktifkan Tombol pada Baris Desktop:'
                : 'Toggle Keys Included in Desktop Bar:'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DESKTOP_KEYS.map((key) => {
                const active = draft.desktopKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDesktopKey(key)}
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-xs border transition-colors ${
                      active
                        ? 'border-[#0078D4] bg-[#0078D4] text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
