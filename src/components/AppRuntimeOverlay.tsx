import React, { useEffect, useState } from 'react';
import {
  Power,
  Keyboard,
  Gamepad2,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Wrench,
  Plus,
  Trash2,
  Save,
  PackageCheck,
  RotateCw,
} from 'lucide-react';
import {
  DllOverrideMode,
  GamepadSkin,
  KeyboardMode,
  KeyboardPresetConfig,
  OrientationMode,
  PreflightReport,
  ResolvedLanguage,
  SystemTelemetry,
  WindowsAppEntry,
  WineRegistryState,
} from '../types/wphone';
import { DEVICE_PROFILES, INITIAL_KEYBOARD_PRESETS } from '../data/mockData';
import { translations } from '../i18n/translations';

interface AppRuntimeOverlayProps {
  app: WindowsAppEntry | null;
  deviceProfileId: string;
  keyboardPresets?: KeyboardPresetConfig[];
  lang: ResolvedLanguage;
  onTerminate: () => void;
  onRefreshState?: () => void;
}

const DEFAULT_DESKTOP_KEYS = [
  'ESC',
  'TAB',
  'CTRL',
  'ALT',
  'SHIFT',
  'WIN',
  'F1',
  'F2',
  'F5',
  'F11',
  'F12',
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

const OVERRIDE_MODES: DllOverrideMode[] = [
  'native,builtin',
  'builtin,native',
  'native',
  'builtin',
  'disabled',
];

export const AppRuntimeOverlay: React.FC<AppRuntimeOverlayProps> = ({
  app,
  deviceProfileId,
  keyboardPresets,
  lang,
  onTerminate,
  onRefreshState,
}) => {
  const t = translations[lang].library.runtimeOverlay;
  const [activeTab, setActiveTab] = useState<'preflight' | 'registry' | 'input'>('preflight');
  const [targetDeviceId, setTargetDeviceId] = useState(deviceProfileId);

  // Preflight state
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);

  // Registry (.reg) & DLL Overrides state
  const [registry, setRegistry] = useState<WineRegistryState | null>(null);
  const [newDllName, setNewDllName] = useState('');
  const [newDllMode, setNewDllMode] = useState<DllOverrideMode>('native,builtin');
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [regNotice, setRegNotice] = useState<string | null>(null);

  // Live GUI & Input Workspace State
  const [kbMode, setKbMode] = useState<KeyboardMode | 'hidden'>(app?.keyboardMode || 'desktop');
  const [gamepadSkin, setGamepadSkin] = useState<GamepadSkin>('playstation');
  const [orientation, setOrientation] = useState<OrientationMode>('landscape');
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const [stickyShift, setStickyShift] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [keyEvents, setKeyEvents] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(88);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);

  const loadPreflight = async (appId: string, devId: string) => {
    setLoadingPreflight(true);
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(appId)}/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceProfileId: devId }),
      });
      if (res.ok) {
        const data = (await res.json()) as PreflightReport;
        setPreflight(data);
      }
    } finally {
      setLoadingPreflight(false);
    }
  };

  const loadRegistry = async (prefixId: string) => {
    const res = await fetch(`/api/prefixes/${encodeURIComponent(prefixId)}/registry`);
    if (res.ok) {
      const data = (await res.json()) as WineRegistryState;
      setRegistry(data);
      setRawText(data.rawUserReg);
    }
  };

  useEffect(() => {
    if (!app) return;
    setTargetDeviceId(deviceProfileId);
    setKbMode(app.keyboardMode);
    setRegNotice(null);
    void loadPreflight(app.id, deviceProfileId);
    void loadRegistry(app.prefixId);
  }, [app?.id, deviceProfileId]);

  useEffect(() => {
    if (!app) return;
    let active = true;
    const poll = () => {
      fetch('/api/telemetry')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SystemTelemetry | null) => {
          if (active && d) setTelemetry(d);
        })
        .catch(() => {});
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [app?.id]);

  if (!app) return null;

  const activePreset =
    keyboardPresets?.find((p) => p.mode === (kbMode === 'hidden' ? 'desktop' : kbMode)) ||
    INITIAL_KEYBOARD_PRESETS[0];
  const desktopKeys = activePreset.desktopKeys.length ? activePreset.desktopKeys : DEFAULT_DESKTOP_KEYS;

  const handleInstallMissingDep = async (depId: string) => {
    const res = await fetch(`/api/prefixes/${encodeURIComponent(app.prefixId)}/deps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depId, action: 'install' }),
    });
    if (res.ok) {
      await loadPreflight(app.id, targetDeviceId);
      await loadRegistry(app.prefixId);
      onRefreshState?.();
      setRegNotice(
        lang === 'id'
          ? `Dependensi "${depId}" dipasang ke drive_c prefix dan user.reg diperbarui.`
          : `Installed "${depId}" into prefix drive_c and updated user.reg.`
      );
    }
  };

  const handleSaveRegistry = async () => {
    if (!registry) return;
    const payload = rawMode
      ? { rawUserReg: rawText }
      : {
          winVersion: registry.winVersion,
          audioDriver: registry.audioDriver,
          directDrawRenderer: registry.directDrawRenderer,
          offscreenRenderingMode: registry.offscreenRenderingMode,
          videoMemorySize: registry.videoMemorySize,
          csmtEnabled: registry.csmtEnabled,
          dllOverrides: registry.dllOverrides,
        };
    const res = await fetch(`/api/prefixes/${encodeURIComponent(app.prefixId)}/registry`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = (await res.json()) as WineRegistryState;
      setRegistry(updated);
      setRawText(updated.rawUserReg);
      await loadPreflight(app.id, targetDeviceId);
      onRefreshState?.();
      setRegNotice(
        lang === 'id'
          ? `Berkas user.reg untuk prefix ${app.prefixId} tersimpan ke disk.`
          : `Saved user.reg for prefix ${app.prefixId} to disk.`
      );
    }
  };

  const handleAddDllOverride = () => {
    if (!registry || !newDllName.trim()) return;
    const clean = newDllName.trim().replace(/\.dll$/i, '').toLowerCase();
    setRegistry({
      ...registry,
      dllOverrides: {
        ...registry.dllOverrides,
        [clean]: newDllMode,
      },
    });
    setNewDllName('');
  };

  const triggerKey = (key: string) => {
    const upper = key.toUpperCase();
    if (upper === 'CTRL') {
      setStickyCtrl((v) => !v);
      return;
    }
    if (upper === 'ALT') {
      setStickyAlt((v) => !v);
      return;
    }
    if (upper === 'SHIFT') {
      setStickyShift((v) => !v);
      return;
    }
    if (upper === 'SPACE') {
      setInputBuffer((prev) => prev + ' ');
    } else if (upper === 'ENTER') {
      setInputBuffer((prev) => prev + '\n');
    } else if (upper === 'BACKSPACE') {
      setInputBuffer((prev) => prev.slice(0, -1));
    } else if (key.length === 1 && !stickyCtrl && !stickyAlt) {
      setInputBuffer((prev) => prev + (stickyShift ? key.toUpperCase() : key.toLowerCase()));
    }

    const combo = [
      stickyCtrl ? 'Ctrl' : null,
      stickyAlt ? 'Alt' : null,
      stickyShift ? 'Shift' : null,
      key,
    ]
      .filter(Boolean)
      .join('+');
    setKeyEvents((prev) => [combo, ...prev].slice(0, 8));
    setStickyCtrl(false);
    setStickyAlt(false);
    setStickyShift(false);
  };

  const selectedDevice = DEVICE_PROFILES.find((d) => d.id === targetDeviceId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-sky-400 font-semibold">{t.runningTitle}</div>
            <div className="font-display text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
              <span>{app.name}</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                {app.arch.toUpperCase()} · {app.prefixId}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
              {(
                [
                  { id: 'preflight' as const, label: 'Preflight & Env' },
                  { id: 'registry' as const, label: 'Registry (.reg) & DLL' },
                  { id: 'input' as const, label: lang === 'id' ? 'Layar & Input GUI' : 'Input & Display' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-[#0078D4] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onTerminate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{t.terminateSafe}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {regNotice && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200 flex items-center justify-between gap-3">
              <span>{regNotice}</span>
              <button type="button" onClick={() => setRegNotice(null)} className="underline">
                OK
              </button>
            </div>
          )}

          {activeTab === 'preflight' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    {lang === 'id'
                      ? 'Target Hardware & Versi Android Pengujian'
                      : 'Target Hardware & Android OS Profile'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedDevice?.isSubAndroid10
                      ? `Android ${selectedDevice.androidVersion} (API ${selectedDevice.androidApiLevel}) · Sub-Android 10 Light Mode`
                      : `Android ${selectedDevice?.androidVersion || 14} (API ${selectedDevice?.androidApiLevel || 34})`}
                  </div>
                </div>
                <select
                  value={targetDeviceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTargetDeviceId(id);
                    void loadPreflight(app.id, id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                >
                  {DEVICE_PROFILES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {loadingPreflight || !preflight ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Evaluating Windows PE metadata, prefix registry, and device constraints...
                </div>
              ) : (
                <>
                  <div
                    className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                      preflight.overallStatus === 'ready'
                        ? 'bg-emerald-950/40 border-emerald-700'
                        : preflight.overallStatus === 'degraded'
                          ? 'bg-amber-950/40 border-amber-700'
                          : 'bg-rose-950/40 border-rose-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {preflight.overallStatus === 'ready' ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      ) : preflight.overallStatus === 'degraded' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wide">
                          {preflight.overallStatus === 'ready'
                            ? lang === 'id'
                              ? 'Siap Dijalankan di Wine WoW64 + Box64'
                              : 'Ready for Wine WoW64 + Box64'
                            : preflight.overallStatus === 'degraded'
                              ? 'Runnable with Warnings / Fallbacks'
                              : 'Blocked by Memory or Missing Runtime'}
                        </div>
                        <div className="text-xs text-slate-300 font-mono tabular-nums">
                          Est. Container Footprint: ~{preflight.estimatedRamMb} MB RAM
                        </div>
                      </div>
                    </div>

                    {preflight.missingDependencies.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {preflight.missingDependencies.map((dep) => (
                          <button
                            key={dep}
                            type="button"
                            onClick={() => handleInstallMissingDep(dep)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>{lang === 'id' ? `Pasang ${dep}` : `Install ${dep}`}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {preflight.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{chk.label}</span>
                          <span
                            className={`text-[11px] font-mono uppercase ${
                              chk.status === 'pass'
                                ? 'text-emerald-400'
                                : chk.status === 'warn'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {chk.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{chk.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-sans font-semibold">
                      <Terminal className="w-4 h-4" />
                      <span>Resolved Launch Command & Environment</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300 break-all">
                      {preflight.commandLine}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300 pt-1">
                      {Object.entries(preflight.resolvedEnv).map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-slate-500">{k}=</span>
                          <span className="text-sky-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'registry' && registry && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-sky-400" />
                    <span>Wine Registry (user.reg) · {app.prefixId}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Changes persist directly to user.reg on disk and update active WINEDLLOVERRIDES.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawMode((v) => !v)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    {rawMode ? 'Structured Editor' : 'Edit Raw user.reg'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRegistry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save user.reg</span>
                  </button>
                </div>
              </div>

              {rawMode ? (
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={14}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <label className="block text-[11px] text-slate-400">Windows Version</label>
                      <select
                        value={registry.winVersion}
                        onChange={(e) =>
                          setRegistry({
                            ...registry,
                            winVersion: e.target.value as 'win7' | 'win10' | 'win11',
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs"
                      >
                        <option value="win10">Windows 10</option>
                        <option value="win7">Windows 7 (Light/Legacy)</option>
                        <option value="win11">Windows 11</option>
                      </select>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <label className="block text-[11px] text-slate-400">DirectDrawRenderer</label>
                      <select
                        value={registry.directDrawRenderer}
                        onChange={(e) =>
                          setRegistry({
                            ...registry,
                            directDrawRenderer: e.target.value as 'opengl' | 'gdi' | 'vulkan',
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs"
                      >
                        <option value="opengl">opengl (VirGL / GLES)</option>
                        <option value="vulkan">vulkan (DXVK)</option>
                        <option value="gdi">gdi (2D Fallback)</option>
                      </select>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <label className="block text-[11px] text-slate-400">VideoMemorySize (MB)</label>
                      <input
                        type="number"
                        value={registry.videoMemorySize}
                        onChange={(e) =>
                          setRegistry({
                            ...registry,
                            videoMemorySize: Number(e.target.value) || 256,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-white">CSMT Multithread</div>
                        <div className="text-[11px] text-slate-400">Wine Direct3D stream</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={registry.csmtEnabled}
                        onChange={(e) =>
                          setRegistry({ ...registry, csmtEnabled: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#0078D4]"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-white">
                      WINEDLLOVERRIDES ([Software\Wine\DllOverrides])
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={newDllName}
                        onChange={(e) => setNewDllName(e.target.value)}
                        placeholder="msvcp140 / d3d11 / mscoree..."
                        className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono"
                      />
                      <select
                        value={newDllMode}
                        onChange={(e) => setNewDllMode(e.target.value as DllOverrideMode)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono"
                      >
                        {OVERRIDE_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddDllOverride}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {Object.entries(registry.dllOverrides).length === 0 ? (
                        <div className="py-3 text-xs text-slate-500">
                          No DLL overrides registered in user.reg yet.
                        </div>
                      ) : (
                        Object.entries(registry.dllOverrides).map(([dll, mode]) => (
                          <div
                            key={dll}
                            className="py-2 flex items-center justify-between gap-3 text-xs font-mono"
                          >
                            <span className="text-sky-300">{dll}.dll</span>
                            <div className="flex items-center gap-2">
                              <select
                                value={mode}
                                onChange={(e) =>
                                  setRegistry({
                                    ...registry,
                                    dllOverrides: {
                                      ...registry.dllOverrides,
                                      [dll]: e.target.value as DllOverrideMode,
                                    },
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                              >
                                {OVERRIDE_MODES.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...registry.dllOverrides };
                                  delete next[dll];
                                  setRegistry({ ...registry, dllOverrides: next });
                                }}
                                className="p-1 text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'input' && (
            <div className="space-y-4">
              {/* Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setKbMode('hidden')}
                      className={`px-2.5 py-1.5 rounded-md font-medium ${
                        kbMode === 'hidden' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                      }`}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setKbMode('desktop')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium ${
                        kbMode === 'desktop' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Unified QWERTY</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKbMode('gaming')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium ${
                        kbMode === 'gaming' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>JoiPlay Pad</span>
                    </button>
                  </div>

                  {kbMode === 'gaming' && (
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setGamepadSkin('playstation')}
                        className={`px-2.5 py-1.5 rounded-md font-medium ${
                          gamepadSkin === 'playstation' ? 'bg-sky-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        PS (△○×□)
                      </button>
                      <button
                        type="button"
                        onClick={() => setGamepadSkin('nintendo')}
                        className={`px-2.5 py-1.5 rounded-md font-medium ${
                          gamepadSkin === 'nintendo' ? 'bg-sky-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        Nintendo (XABY)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setOrientation((o) => (o === 'landscape' ? 'portrait' : 'landscape'))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                    <span>{orientation === 'landscape' ? 'Landscape (1280×720)' : 'Portrait (720×1280)'}</span>
                  </button>
                </div>

                <label className="text-xs text-slate-300 flex items-center gap-2">
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

              {/* Simulated In-App X11 Viewport with Mini Monitor HUD + Exit Button + Overlays */}
              <div
                className={`mx-auto rounded-2xl border border-slate-700 bg-[#071122] relative overflow-hidden flex flex-col justify-between transition-all ${
                  orientation === 'landscape' ? 'w-full min-h-[380px]' : 'w-full max-w-[360px] min-h-[480px]'
                }`}
              >
                {/* Top-Right Mini Telemetry Monitor + Red Exit App Button */}
                <div className="p-2.5 flex items-center justify-end gap-2 z-10">
                  <div className="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700 font-mono text-[11px] text-sky-400 tabular-nums">
                    CPU {telemetry?.cpuPercent ?? 8}% · {telemetry?.ramUsedMb ?? 420}MB · 60FPS
                  </div>
                  <button
                    type="button"
                    onClick={onTerminate}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold"
                  >
                    <Power className="w-3 h-3" />
                    <span>Exit App</span>
                  </button>
                </div>

                {/* Simulated Wine Notepad Window */}
                <div className="px-4 py-2 flex-1 flex items-center justify-center">
                  <div className="w-full max-w-2xl rounded-lg border border-slate-600 bg-slate-900/95 shadow-xl overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-700 flex items-center justify-between text-xs text-slate-200">
                      <span>{app.name} — X11 Workspace ({orientation === 'landscape' ? '1280×720' : '720×1280'})</span>
                      <span className="font-mono text-slate-400">─ □ ✕</span>
                    </div>
                    <textarea
                      rows={4}
                      value={inputBuffer}
                      onChange={(e) => setInputBuffer(e.target.value)}
                      placeholder={t.textPlaceholder}
                      className="w-full p-3 bg-slate-900 text-slate-100 font-mono text-xs focus:outline-none"
                    />
                    {keyEvents.length > 0 && (
                      <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-1.5 text-[11px] font-mono">
                        {keyEvents.map((ev, idx) => (
                          <span key={`${ev}-${idx}`} className="px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Overlay: Unified PC + QWERTY or JoiPlay Gamepad */}
                {kbMode === 'desktop' && (
                  <div
                    style={{ opacity: opacity / 100 }}
                    className="bg-slate-950/95 border-t border-slate-800 p-2.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap gap-1">
                      {desktopKeys.map((k) => {
                        const active =
                          (k === 'CTRL' && stickyCtrl) ||
                          (k === 'ALT' && stickyAlt) ||
                          (k === 'SHIFT' && stickyShift);
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => triggerKey(k)}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold ${
                              active
                                ? 'bg-[#0078D4] text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                            }`}
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      {QWERTY_ROWS.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          className="grid gap-1"
                          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                        >
                          {row.map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => triggerKey(k)}
                              className="py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white"
                            >
                              {stickyShift ? k : k.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      ))}
                      <div className="grid grid-cols-12 gap-1">
                        <button
                          type="button"
                          onClick={() => triggerKey('SHIFT')}
                          className={`col-span-2 py-1.5 rounded border text-xs font-mono ${
                            stickyShift ? 'bg-[#0078D4] border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-200'
                          }`}
                        >
                          SHIFT
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerKey('SPACE')}
                          className="col-span-6 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200"
                        >
                          SPACE
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerKey('BACKSPACE')}
                          className="col-span-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200"
                        >
                          ⌫
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerKey('ENTER')}
                          className="col-span-2 py-1.5 rounded bg-[#0078D4] text-xs font-mono text-white font-semibold"
                        >
                          ENTER
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {kbMode === 'gaming' && (
                  <div
                    style={{ opacity: opacity / 100 }}
                    className="p-3 bg-slate-950/85 border-t border-slate-800 space-y-2"
                  >
                    <div className="flex justify-between px-2">
                      <div className="flex gap-2">
                        {['L2', 'L1'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => triggerKey(s)}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-mono font-bold"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {['R1', 'R2'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => triggerKey(s)}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-mono font-bold"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 px-2">
                      <div className="grid grid-cols-3 gap-1 w-28">
                        <div />
                        <button type="button" onClick={() => triggerKey('UP')} className="h-9 rounded bg-slate-800 border border-slate-600 text-xs font-bold">↑</button>
                        <div />
                        <button type="button" onClick={() => triggerKey('LEFT')} className="h-9 rounded bg-slate-800 border border-slate-600 text-xs font-bold">←</button>
                        <div className="h-9 rounded bg-slate-900" />
                        <button type="button" onClick={() => triggerKey('RIGHT')} className="h-9 rounded bg-slate-800 border border-slate-600 text-xs font-bold">→</button>
                        <div />
                        <button type="button" onClick={() => triggerKey('DOWN')} className="h-9 rounded bg-slate-800 border border-slate-600 text-xs font-bold">↓</button>
                        <div />
                      </div>

                      <div className="flex items-center gap-2">
                        {['SELECT', 'START'].map((btn) => (
                          <button
                            key={btn}
                            type="button"
                            onClick={() => triggerKey(btn)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-[11px] font-mono"
                          >
                            {btn}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-1 w-32 items-center">
                        <div />
                        <button
                          type="button"
                          onClick={() => triggerKey(gamepadSkin === 'playstation' ? '△' : 'X')}
                          className="h-10 rounded-full bg-slate-800 border border-emerald-400 text-emerald-400 text-sm font-bold"
                        >
                          {gamepadSkin === 'playstation' ? '△' : 'X'}
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => triggerKey(gamepadSkin === 'playstation' ? '□' : 'Y')}
                          className="h-10 rounded-full bg-slate-800 border border-pink-400 text-pink-400 text-sm font-bold"
                        >
                          {gamepadSkin === 'playstation' ? '□' : 'Y'}
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => triggerKey(gamepadSkin === 'playstation' ? '○' : 'A')}
                          className="h-10 rounded-full bg-slate-800 border border-rose-400 text-rose-400 text-sm font-bold"
                        >
                          {gamepadSkin === 'playstation' ? '○' : 'A'}
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => triggerKey(gamepadSkin === 'playstation' ? '×' : 'B')}
                          className="h-10 rounded-full bg-slate-800 border border-sky-400 text-sky-400 text-sm font-bold"
                        >
                          {gamepadSkin === 'playstation' ? '×' : 'B'}
                        </button>
                        <div />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
