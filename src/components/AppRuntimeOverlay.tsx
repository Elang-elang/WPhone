import React, { useState } from 'react';
import { Power, Keyboard, Gamepad2, Terminal } from 'lucide-react';
import { KeyboardMode, ResolvedLanguage, WindowsAppEntry } from '../types/wphone';
import { translations } from '../i18n/translations';

interface AppRuntimeOverlayProps {
  app: WindowsAppEntry | null;
  lang: ResolvedLanguage;
  onTerminate: () => void;
}

const DESKTOP_KEYS = [
  'ESC',
  'TAB',
  'CTRL',
  'ALT',
  'SHIFT',
  'META',
  'F1',
  'F2',
  'F5',
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

export const AppRuntimeOverlay: React.FC<AppRuntimeOverlayProps> = ({
  app,
  lang,
  onTerminate,
}) => {
  const t = translations[lang].library.runtimeOverlay;
  const [kbMode, setKbMode] = useState<KeyboardMode>(app?.keyboardMode || 'desktop');
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const [stickyShift, setStickyShift] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [keyEvents, setKeyEvents] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(85);

  if (!app) return null;

  const triggerKey = (key: string) => {
    if (key === 'CTRL') {
      setStickyCtrl((v) => !v);
      return;
    }
    if (key === 'ALT') {
      setStickyAlt((v) => !v);
      return;
    }
    if (key === 'SHIFT') {
      setStickyShift((v) => !v);
      return;
    }
    const combo = [
      stickyCtrl ? 'Ctrl' : null,
      stickyAlt ? 'Alt' : null,
      stickyShift ? 'Shift' : null,
      key,
    ]
      .filter(Boolean)
      .join('+');
    setKeyEvents((prev) => [combo, ...prev].slice(0, 6));
    setStickyCtrl(false);
    setStickyAlt(false);
    setStickyShift(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Session Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-sky-400 font-semibold">{t.runningTitle}</div>
            <div className="font-display text-sm sm:text-base font-bold text-white">
              {app.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Keyboard Mode Live */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setKbMode('desktop')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium ${
                  kbMode === 'desktop' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>{t.desktopKb}</span>
              </button>
              <button
                type="button"
                onClick={() => setKbMode('gaming')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium ${
                  kbMode === 'gaming' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>{t.gamingKb}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onTerminate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{t.terminateSafe}</span>
            </button>
          </div>
        </div>

        {/* Simulated Windows App Surface */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2.5">
              <span>
                WINEPREFIX=/WPhone/prefixes/{app.prefixId} · {app.arch} WoW64 · {app.resolution}
              </span>
              <span>
                {app.graphicsBackend} · {app.audioDriver}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <Terminal className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs font-mono text-slate-300">
                <div>
                  $ box64 wine64 &quot;{app.executablePath}&quot; {app.arguments}
                </div>
                <div className="text-emerald-400">
                  [WineWoW64] PE module loaded ({app.arch}) · Audio sink: AAudio connected
                </div>
                {keyEvents.length > 0 && (
                  <div className="text-sky-300">
                    [InputBridge] Last dispatched keys: {keyEvents.join(' , ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Dual Keyboard Demo */}
          {kbMode === 'desktop' ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{t.desktopKb}</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {t.preset}: {app.keyboardPreset}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DESKTOP_KEYS.map((key) => {
                  const isStickyActive =
                    (key === 'CTRL' && stickyCtrl) ||
                    (key === 'ALT' && stickyAlt) ||
                    (key === 'SHIFT' && stickyShift);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => triggerKey(key)}
                      className={`min-h-[36px] px-2.5 py-1 rounded-md font-mono text-xs font-medium border transition-colors ${
                        isStickyActive
                          ? 'bg-[#0078D4] border-[#0078D4] text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t.textInputLabel}
                </label>
                <input
                  type="text"
                  value={inputBuffer}
                  onChange={(e) => setInputBuffer(e.target.value)}
                  placeholder={t.textPlaceholder}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:border-[#0078D4] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-4"
              style={{ opacity: opacity / 100 }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-200">{t.gamingKb}</span>
                <label className="flex items-center gap-2 text-slate-400">
                  <span>{t.opacity}:</span>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="accent-[#0078D4]"
                  />
                  <span className="font-mono tabular-nums">{opacity}%</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                {/* D-Pad + Virtual Stick */}
                <div className="grid grid-cols-3 gap-1 w-32">
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('UP')}
                    className="h-10 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 font-mono text-xs"
                  >
                    ↑
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('LEFT')}
                    className="h-10 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 font-mono text-xs"
                  >
                    ←
                  </button>
                  <div className="h-10 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                    PAD
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerKey('RIGHT')}
                    className="h-10 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 font-mono text-xs"
                  >
                    →
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('DOWN')}
                    className="h-10 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 font-mono text-xs"
                  >
                    ↓
                  </button>
                  <div />
                </div>

                {/* Start / Select */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => triggerKey('SELECT')}
                    className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono hover:bg-slate-700"
                  >
                    SELECT
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerKey('START')}
                    className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono hover:bg-slate-700"
                  >
                    START
                  </button>
                </div>

                {/* A/B/X/Y */}
                <div className="grid grid-cols-3 gap-1 w-32">
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('Y')}
                    className="h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-amber-300"
                  >
                    Y
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('X')}
                    className="h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-sky-300"
                  >
                    X
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('B')}
                    className="h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-rose-300"
                  >
                    B
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => triggerKey('A')}
                    className="h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-xs text-emerald-300"
                  >
                    A
                  </button>
                  <div />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
