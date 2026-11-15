import React, { useRef, useState } from 'react';
import { Gamepad2, Keyboard, Plus, RotateCcw, Save, Sliders } from 'lucide-react';
import { GamepadSkin, KeyboardPresetConfig, ResolvedLanguage } from '../types/wphone';
import { INITIAL_KEYBOARD_PRESETS } from '../data/mockData';

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
  'WIN',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F8',
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

const QWERTY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
];

const DEFAULT_JOIPLAY_CONTROLS = INITIAL_KEYBOARD_PRESETS[1].gamingControls;

export const KeyboardStudio: React.FC<KeyboardStudioProps> = ({
  presets,
  lang,
  onSavePreset,
}) => {
  const [activeId, setActiveId] = useState(presets[0]?.id || 'preset-desktop-ide');
  const current = presets.find((p) => p.id === activeId) || presets[0];

  const [draft, setDraft] = useState<KeyboardPresetConfig>(() => {
    const clone = JSON.parse(JSON.stringify(current)) as KeyboardPresetConfig;
    if (!clone.gamingControls || clone.gamingControls.length === 0) {
      clone.gamingControls = JSON.parse(JSON.stringify(DEFAULT_JOIPLAY_CONTROLS));
    }
    if (!clone.gamepadSkin) clone.gamepadSkin = 'playstation';
    if (clone.qwertyEnabled === undefined) clone.qwertyEnabled = true;
    return clone;
  });

  const [selectedControlId, setSelectedControlId] = useState<string>(
    draft.gamingControls[0]?.id || 'btn-bottom'
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleSelectPreset = (id: string) => {
    const found = presets.find((p) => p.id === id);
    if (!found) return;
    const clone = JSON.parse(JSON.stringify(found)) as KeyboardPresetConfig;
    if (!clone.gamingControls || clone.gamingControls.length === 0) {
      clone.gamingControls = JSON.parse(JSON.stringify(DEFAULT_JOIPLAY_CONTROLS));
    }
    if (!clone.gamepadSkin) clone.gamepadSkin = 'playstation';
    if (clone.qwertyEnabled === undefined) clone.qwertyEnabled = true;
    setActiveId(id);
    setDraft(clone);
    setSelectedControlId(clone.gamingControls[0]?.id || 'btn-bottom');
    setSavedNotice(false);
  };

  const handleCreatePreset = () => {
    const newPreset: KeyboardPresetConfig = {
      ...JSON.parse(JSON.stringify(draft)),
      id: `preset-${Date.now().toString(36)}`,
      name: draft.mode === 'gaming' ? 'Custom JoiPlay Pad' : 'Custom Unified Keyboard',
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

  const handleSwitchSkin = (skin: GamepadSkin) => {
    const controls = (draft.gamingControls.length ? draft.gamingControls : DEFAULT_JOIPLAY_CONTROLS).map(
      (c) => {
        if (c.id === 'btn-top' || c.id === 'btn-y') {
          return { ...c, label: skin === 'playstation' ? '△' : 'X' };
        }
        if (c.id === 'btn-right' || c.id === 'btn-b') {
          return { ...c, label: skin === 'playstation' ? '○' : 'A' };
        }
        if (c.id === 'btn-bottom' || c.id === 'btn-a') {
          return { ...c, label: skin === 'playstation' ? '×' : 'B' };
        }
        if (c.id === 'btn-left' || c.id === 'btn-x') {
          return { ...c, label: skin === 'playstation' ? '□' : 'Y' };
        }
        return c;
      }
    );
    setDraft((prev) => ({ ...prev, gamepadSkin: skin, gamingControls: controls }));
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

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
    const yPct = Math.round(Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100)));
    setDraft((prev) => ({
      ...prev,
      gamingControls: prev.gamingControls.map((c) =>
        c.id === draggingId ? { ...c, xPercent: xPct, yPercent: yPct } : c
      ),
    }));
  };

  const skin = draft.gamepadSkin || 'playstation';

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {lang === 'id'
              ? 'Studio Keyboard Terpadu & Gamepad JoiPlay'
              : 'Unified Keyboard & JoiPlay Gamepad Studio'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'id'
              ? 'Seret tombol langsung di atas pratinjau GUI Desktop Windows + Notepad, pilih skin PlayStation / Nintendo, dan atur tombol QWERTY.'
              : 'Drag controls directly over the Windows Desktop + Notepad reference preview, switch PlayStation/Nintendo skins, and customize Unified QWERTY.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                gamingControls: JSON.parse(JSON.stringify(DEFAULT_JOIPLAY_CONTROLS)),
              }))
            }
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleCreatePreset}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'id' ? 'Duplikasi' : 'Duplicate'}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedNotice ? (lang === 'id' ? 'Tersimpan' : 'Saved') : lang === 'id' ? 'Simpan Preset' : 'Save Preset'}</span>
          </button>
        </div>
      </div>

      {/* Preset & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeId === p.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {p.mode === 'gaming' ? <Gamepad2 className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, mode: 'desktop' })}
            className={`px-3 py-1.5 rounded-md font-semibold ${
              draft.mode === 'desktop' ? 'bg-[#0078D4] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Unified QWERTY + PC
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, mode: 'gaming' })}
            className={`px-3 py-1.5 rounded-md font-semibold ${
              draft.mode === 'gaming' ? 'bg-[#0078D4] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            JoiPlay Gamepad
          </button>
        </div>
      </div>

      {/* Meta & Skin Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
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
            JoiPlay Skin
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchSkin('playstation')}
              className={`flex-1 py-2 px-2 rounded-lg border font-semibold ${
                skin === 'playstation'
                  ? 'border-[#0078D4] bg-[#0078D4] text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              PS (△○×□)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchSkin('nintendo')}
              className={`flex-1 py-2 px-2 rounded-lg border font-semibold ${
                skin === 'nintendo'
                  ? 'border-[#0078D4] bg-[#0078D4] text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              Nintendo (XABY)
            </button>
          </div>
        </div>
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {lang === 'id' ? 'Transparansi' : 'Opacity'}: {draft.opacity}%
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
        <div className="flex flex-col justify-end gap-1.5">
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.qwertyEnabled !== false}
              onChange={(e) => setDraft({ ...draft, qwertyEnabled: e.target.checked })}
              className="accent-[#0078D4]"
            />
            <span>{lang === 'id' ? 'Keyboard QWERTY Terintegrasi' : 'Integrated QWERTY Deck'}</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.stickyModifiers}
              onChange={(e) => setDraft({ ...draft, stickyModifiers: e.target.checked })}
              className="accent-[#0078D4]"
            />
            <span>Sticky CTRL / ALT / SHIFT</span>
          </label>
        </div>
      </div>

      {/* Desktop GUI Reference Canvas + Live Draggable Controls */}
      {draft.mode === 'gaming' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div
            ref={canvasRef}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={() => setDraggingId(null)}
            onPointerLeave={() => setDraggingId(null)}
            className="lg:col-span-8 rounded-2xl border border-slate-300 dark:border-slate-700 bg-[#0A192F] relative aspect-video overflow-hidden select-none touch-none"
          >
            {/* Simulated Windows Desktop + Wine Notepad GUI reference */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              <div className="flex-1 p-5 flex items-center justify-center">
                <div className="w-[70%] h-[82%] rounded-md border border-slate-600 bg-slate-800/95 shadow-lg flex flex-col overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-[11px] text-slate-200">
                    <span>Untitled - Wine Notepad (GUI Reference)</span>
                    <span className="font-mono text-slate-400">─ □ ✕</span>
                  </div>
                  <div className="px-3 py-1 bg-slate-800 border-b border-slate-700 text-[10px] text-slate-400">
                    File &nbsp; Edit &nbsp; Format &nbsp; View &nbsp; Help
                  </div>
                  <div className="p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
                    C:\windows\system32\notepad.exe<br />
                    Drag JoiPlay gamepad buttons anywhere on this desktop canvas to prevent UI overlap.
                  </div>
                </div>
              </div>
              <div className="h-7 bg-slate-950/90 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-400">
                <span>⊞ Start &nbsp;|&nbsp; Wine Notepad &nbsp;|&nbsp; Box64 WoW64</span>
                <span className="font-mono">1280×720</span>
              </div>
            </div>

            {draft.gamingControls.map((ctrl) => {
              const isShoulder = ['l1', 'l2', 'r1', 'r2', 'select', 'start'].includes(ctrl.id);
              const isSelected = selectedControlId === ctrl.id;
              return (
                <button
                  key={ctrl.id}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedControlId(ctrl.id);
                    setDraggingId(ctrl.id);
                  }}
                  style={{
                    left: `${ctrl.xPercent}%`,
                    top: `${ctrl.yPercent}%`,
                    width: `${ctrl.sizePx}px`,
                    height: isShoulder ? `${Math.round(ctrl.sizePx * 0.72)}px` : `${ctrl.sizePx}px`,
                    opacity: ctrl.visible ? draft.opacity / 100 : 0.25,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`absolute ${
                    isShoulder ? 'rounded-lg' : 'rounded-full'
                  } border-2 flex flex-col items-center justify-center text-[10px] font-mono font-bold cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? 'border-[#38BDF8] bg-[#0078D4]/45 text-white'
                      : 'border-slate-500 bg-slate-900/80 text-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs">{ctrl.label}</span>
                  <span className="text-[9px] text-sky-300">{ctrl.mappedKey}</span>
                </button>
              );
            })}
          </div>

          {/* Control Inspector */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
            <div className="font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0078D4]" />
              <span>
                {selectedControl
                  ? `${lang === 'id' ? 'Edit Kontrol' : 'Edit Control'}: ${selectedControl.label}`
                  : 'Select control'}
              </span>
            </div>

            {selectedControl && (
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-600 dark:text-slate-300">Visible in Overlay</span>
                  <input
                    type="checkbox"
                    checked={selectedControl.visible}
                    onChange={(e) => updateControl({ visible: e.target.checked })}
                    className="h-4 w-4 accent-[#0078D4]"
                  />
                </label>
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
                    Position: X={selectedControl.xPercent}% · Y={selectedControl.yPercent}%
                  </label>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 tabular-nums">
                    Size: {selectedControl.sizePx}px
                  </label>
                  <input
                    type="range"
                    min={36}
                    max={116}
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
        <div className="space-y-4">
          {/* Desktop Reference + Unified QWERTY & Desktop Bar Preview */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-[#0A192F] overflow-hidden flex flex-col">
            <div className="p-4 flex items-center justify-center">
              <div className="w-full max-w-xl rounded-md border border-slate-600 bg-slate-800/95 p-3 font-mono text-[11px] text-slate-200">
                <div className="text-slate-400 border-b border-slate-700 pb-1 mb-2">
                  Untitled - Wine Notepad (Desktop Reference)
                </div>
                Unified PC Modifier Bar + Integrated 4-Row QWERTY Deck Preview
              </div>
            </div>

            <div
              className="bg-slate-950/95 border-t border-slate-800 p-3 space-y-2"
              style={{ opacity: draft.opacity / 100 }}
            >
              <div className="flex flex-wrap gap-1.5">
                {draft.desktopKeys.map((key) => (
                  <span
                    key={key}
                    className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sky-300 font-mono text-[11px]"
                  >
                    {key}
                  </span>
                ))}
              </div>
              {draft.qwertyEnabled !== false && (
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  {QWERTY_ROWS.map((row, idx) => (
                    <div key={idx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                      {row.map((k) => (
                        <span
                          key={k}
                          className="py-1.5 rounded bg-slate-800/90 border border-slate-700 text-center text-[11px] font-mono text-white"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'id'
                ? 'Aktifkan / Nonaktifkan Tombol pada Baris Desktop:'
                : 'Toggle Keys Included in Desktop Modifier Bar:'}
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
