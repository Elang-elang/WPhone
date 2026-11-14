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
} from 'lucide-react';
import {
  DllOverrideMode,
  KeyboardMode,
  PreflightReport,
  ResolvedLanguage,
  WindowsAppEntry,
  WineRegistryState,
} from '../types/wphone';
import { DEVICE_PROFILES } from '../data/mockData';
import { translations } from '../i18n/translations';

interface AppRuntimeOverlayProps {
  app: WindowsAppEntry | null;
  deviceProfileId: string;
  lang: ResolvedLanguage;
  onTerminate: () => void;
  onRefreshState?: () => void;
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

  // Input testbed state
  const [kbMode, setKbMode] = useState<KeyboardMode>(app?.keyboardMode || 'desktop');
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const [stickyShift, setStickyShift] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [keyEvents, setKeyEvents] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(88);

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

  if (!app) return null;

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
                  {
                    id: 'preflight' as const,
                    label: lang === 'id' ? 'Preflight & Env' : 'Preflight & Env',
                  },
                  {
                    id: 'registry' as const,
                    label: lang === 'id' ? 'Registry (.reg) & DLL' : 'Registry (.reg) & DLL',
                  },
                  {
                    id: 'input' as const,
                    label: lang === 'id' ? 'Uji Input & Layar' : 'Input & Display',
                  },
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
              {/* Target Device Simulator Selector (including Android 7/8/9) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    {lang === 'id'
                      ? 'Target Hardware & Versi Android Pengujian'
                      : 'Target Hardware & Android OS Profile'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedDevice?.isSubAndroid10
                      ? lang === 'id'
                        ? `Android ${selectedDevice.androidVersion} (API ${selectedDevice.androidApiLevel}) · Mode Ringan <10 Aktif`
                        : `Android ${selectedDevice.androidVersion} (API ${selectedDevice.androidApiLevel}) · Sub-Android 10 Light Mode`
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
                  {/* Overall Readiness Banner */}
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
                              ? lang === 'id'
                                ? 'Berjalan dengan Catatan / Fallback'
                                : 'Runnable with Warnings / Fallbacks'
                              : lang === 'id'
                                ? 'Melebihi Batas Memori / Prasyarat'
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
                            <span>
                              {lang === 'id' ? `Pasang ${dep}` : `Install ${dep}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Compatibility Checks Grid */}
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

                  {/* Resolved Launch Command & Env */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-sans font-semibold">
                      <Terminal className="w-4 h-4" />
                      <span>
                        {lang === 'id'
                          ? 'Perintah & Environment Peluncuran Aktual'
                          : 'Resolved Launch Command & Environment'}
                      </span>
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
                    <span>Wine Registry (`user.reg`) · {app.prefixId}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === 'id'
                      ? 'Perubahan ditulis langsung ke berkas user.reg di disk dan memengaruhi WINEDLLOVERRIDES.'
                      : 'Changes persist directly to user.reg on disk and update active WINEDLLOVERRIDES.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawMode((v) => !v)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    {rawMode
                      ? lang === 'id'
                        ? 'Editor Terstruktur'
                        : 'Structured Editor'
                      : lang === 'id'
                        ? 'Edit user.reg Mentah'
                        : 'Edit Raw user.reg'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRegistry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Simpan user.reg' : 'Save user.reg'}</span>
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

                  {/* DLL Overrides Manager */}
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
                        <span>{lang === 'id' ? 'Tambah' : 'Add'}</span>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setKbMode('desktop')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium ${
                      kbMode === 'desktop' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>{t.desktopKb}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKbMode('gaming')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium ${
                      kbMode === 'gaming' ? 'bg-[#0078D4] text-white' : 'text-slate-300'
                    }`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>{t.gamingKb}</span>
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

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="block text-xs font-medium text-slate-300">{t.textInputLabel}</label>
                <input
                  type="text"
                  value={inputBuffer}
                  onChange={(e) => setInputBuffer(e.target.value)}
                  placeholder={t.textPlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                />
                {keyEvents.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {keyEvents.map((ev, idx) => (
                      <span
                        key={`${ev}-${idx}`}
                        className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{ opacity: opacity / 100 }}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800"
              >
                {kbMode === 'desktop' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {DESKTOP_KEYS.map((k) => {
                      const active =
                        (k === 'CTRL' && stickyCtrl) ||
                        (k === 'ALT' && stickyAlt) ||
                        (k === 'SHIFT' && stickyShift);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => triggerKey(k)}
                          className={`px-2.5 py-2 min-w-[44px] min-h-[40px] rounded-md text-xs font-mono font-semibold transition-colors ${
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
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                    <div className="grid grid-cols-3 gap-1.5 w-36">
                      <div />
                      <button
                        type="button"
                        onClick={() => triggerKey('W / Up')}
                        className="h-10 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono"
                      >
                        ↑
                      </button>
                      <div />
                      <button
                        type="button"
                        onClick={() => triggerKey('A / Left')}
                        className="h-10 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerKey('S / Down')}
                        className="h-10 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerKey('D / Right')}
                        className="h-10 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono"
                      >
                        →
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {['SELECT', 'START'].map((btn) => (
                        <button
                          key={btn}
                          type="button"
                          onClick={() => triggerKey(btn)}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono"
                        >
                          {btn}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {['Y', 'X', 'B', 'A'].map((btn) => (
                        <button
                          key={btn}
                          type="button"
                          onClick={() => triggerKey(`BTN_${btn}`)}
                          className="w-11 h-11 rounded-full bg-slate-800 hover:bg-[#0078D4] border border-slate-600 text-xs font-bold"
                        >
                          {btn}
                        </button>
                      ))}
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
