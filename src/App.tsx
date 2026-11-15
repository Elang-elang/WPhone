import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  Sliders,
  Wrench,
  HelpCircle,
  BookOpen,
  Layers,
  ShieldCheck,
  Keyboard,
  FolderGit2,
} from 'lucide-react';
import {
  AdvancedSetupConfig,
  DeviceViewportMode,
  EasyProfile,
  GlobalRuntimeConfig,
  InstalledPlugin,
  KeyboardPresetConfig,
  LanguagePreference,
  ManagedProcess,
  PluginSandboxExecutionResult,
  ResolvedLanguage,
  ResolvedTheme,
  SetupMode,
  ThemePreference,
  WindowsAppEntry,
  WorkspaceSection,
  WPhoneSystemState,
} from './types/wphone';
import { createInitialSystemState, DEVICE_PROFILES } from './data/mockData';
import { translations } from './i18n/translations';
import { TopBar } from './components/TopBar';
import { SetupWizard } from './components/SetupWizard';
import { AppLibrary } from './components/AppLibrary';
import { AddAppModal } from './components/AddAppModal';
import { AppRuntimeOverlay } from './components/AppRuntimeOverlay';
import { AdminPanel } from './components/AdminPanel';
import { KeyboardStudio } from './components/KeyboardStudio';
import { AndroidProjectView } from './components/AndroidProjectView';
import { DocsPortal } from './components/DocsPortal';
import { CompatibilityView } from './components/CompatibilityView';
import { HelperDrawer } from './components/HelperDrawer';
import { WPhoneIcon } from './components/WPhoneIcon';

const STORAGE_KEY = 'wphone_fullstack_cache_v2';
const PREF_KEY = 'wphone_ui_prefs_v2';

const getTimeString = () => {
  const d = new Date();
  return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

export default function App() {
  const [systemState, setSystemState] = useState<WPhoneSystemState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as WPhoneSystemState;
    } catch {
      // ignore
    }
    return createInitialSystemState();
  });

  const serverLoadedRef = useRef(false);

  const [langPref, setLangPref] = useState<LanguagePreference>(() => {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved) return (JSON.parse(saved).langPref as LanguagePreference) || 'auto';
    } catch {
      // ignore
    }
    return 'auto';
  });

  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved) return (JSON.parse(saved).themePref as ThemePreference) || 'dark';
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [viewportMode, setViewportMode] = useState<DeviceViewportMode>('expanded');
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('console');
  const [protoView, setProtoView] = useState<'wizard' | 'library' | 'admin' | 'keyboard'>(() =>
    systemState.initialized ? 'library' : 'wizard'
  );

  // Modals & Overlays
  const [helperOpen, setHelperOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<WindowsAppEntry | null>(null);
  const [runningApp, setRunningApp] = useState<WindowsAppEntry | null>(null);

  // Hydrate real state from Express backend on mount
  useEffect(() => {
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((serverState: WPhoneSystemState | null) => {
        if (serverState && Array.isArray(serverState.apps)) {
          setSystemState(serverState);
          if (serverState.initialized) {
            setProtoView((prev) => (prev === 'wizard' ? 'library' : prev));
          }
        }
        serverLoadedRef.current = true;
      })
      .catch(() => {
        serverLoadedRef.current = true;
      });
  }, []);

  // Sync changes back to Express backend + localStorage cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(systemState));
    } catch {
      // ignore
    }
    if (!serverLoadedRef.current) return;
    const timer = window.setTimeout(() => {
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemState),
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [systemState]);

  // System listeners for auto theme & auto language
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  const resolvedTheme: ResolvedTheme =
    themePref === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : themePref;

  const resolvedLang: ResolvedLanguage = useMemo(() => {
    if (langPref !== 'auto') return langPref;
    const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
    return nav.startsWith('id') ? 'id' : 'en';
  }, [langPref]);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ langPref, themePref }));
    } catch {
      // ignore
    }
  }, [langPref, themePref]);

  // Active Frontend Plugin Accent Color (live plugin execution demonstration)
  const activeFrontendAccent = useMemo(() => {
    const enabledFrontend = systemState.plugins.find(
      (p) => p.enabled && p.category === 'frontend' && p.accentColor
    );
    return enabledFrontend?.accentColor || null;
  }, [systemState.plugins]);

  const t = translations[resolvedLang];

  // Handlers
  const handleCompleteWizard = (updates: {
    deviceProfileId: string;
    setupMode: SetupMode;
    easyProfile: EasyProfile;
    advancedConfig: AdvancedSetupConfig;
    installedComponentIds: string[];
    logMessageId: string;
    logMessageEn: string;
  }) => {
    setSystemState((prev) => ({
      ...prev,
      initialized: true,
      deviceProfileId: updates.deviceProfileId,
      setupMode: updates.setupMode,
      easyProfile: updates.easyProfile,
      advancedConfig: updates.advancedConfig,
      components: prev.components.map((c) => ({
        ...c,
        installed: updates.installedComponentIds.includes(c.id),
      })),
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'SetupWizard',
          level: 'INFO',
          messageId: updates.logMessageId,
          messageEn: updates.logMessageEn,
        },
        ...prev.logs,
      ],
    }));
    setProtoView('library');
  };

  const handleSaveApp = (app: WindowsAppEntry, isNew: boolean) => {
    setSystemState((prev) => {
      const nextApps = isNew
        ? [app, ...prev.apps]
        : prev.apps.map((a) => (a.id === app.id ? app : a));

      const hasPrefix = prev.prefixes.some((p) => p.id === app.prefixId);
      const nextPrefixes = hasPrefix
        ? prev.prefixes
        : [
            {
              id: app.prefixId,
              appId: app.id,
              path: `/WPhone/prefixes/${app.prefixId}`,
              winVersion: prev.globalConfig.defaultWinVer,
              sizeMb: 128,
              installedDeps: app.dependencies,
              createdAt: new Date().toISOString().slice(0, 10),
            },
            ...prev.prefixes,
          ];

      return {
        ...prev,
        apps: nextApps,
        prefixes: nextPrefixes,
        logs: [
          {
            id: `log-${Date.now()}`,
            timestamp: getTimeString(),
            module: app.sha256 ? 'PEInspector' : 'PrefixMgr',
            level: 'INFO',
            messageId: isNew
              ? `Aplikasi "${app.name}" didaftarkan ke prefix disk ${app.prefixId} (${app.arch}).`
              : `Konfigurasi "${app.name}" diperbarui.`,
            messageEn: isNew
              ? `Registered "${app.name}" with disk prefix ${app.prefixId} (${app.arch}).`
              : `Updated configuration for "${app.name}".`,
          },
          ...prev.logs,
        ],
      };
    });
  };

  const handleUnregisterApp = (appId: string) => {
    setSystemState((prev) => {
      const target = prev.apps.find((a) => a.id === appId);
      return {
        ...prev,
        apps: prev.apps.filter((a) => a.id !== appId),
        processes: prev.processes.filter((p) => p.appId !== appId),
        logs: target
          ? [
              {
                id: `log-${Date.now()}`,
                timestamp: getTimeString(),
                module: 'PrefixMgr',
                level: 'INFO',
                messageId: `Pendaftaran "${target.name}" dihapus dari Library (prefix ${target.prefixId} tetap di disk).`,
                messageEn: `Unregistered "${target.name}" from Library (prefix ${target.prefixId} preserved on disk).`,
              },
              ...prev.logs,
            ]
          : prev.logs,
      };
    });
  };

  const handleLaunchApp = (app: WindowsAppEntry) => {
    const nowLabel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const pid = Math.floor(14000 + Math.random() * 40000);
    const proc: ManagedProcess = {
      pid,
      appId: app.id,
      appName: app.name,
      prefixId: app.prefixId,
      arch: app.arch,
      graphicsBackend: app.graphicsBackend,
      status: 'running',
      cpuPercent: app.category === 'Games' ? 42 : 11,
      ramMb: app.category === 'Games' ? 1420 : 340,
      startedAt: nowLabel,
      commandLine: `box64 wine64 "${app.executablePath}" ${app.arguments}`.trim(),
    };
    setSystemState((prev) => ({
      ...prev,
      apps: prev.apps.map((a) => (a.id === app.id ? { ...a, lastRunAt: nowLabel } : a)),
      processes: [proc, ...prev.processes.filter((p) => p.appId !== app.id)],
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'WineWoW64',
          level: 'INFO',
          messageId: `Meluncurkan "${app.name}" (PID ${pid}, ${app.arch}) di prefix ${app.prefixId}.`,
          messageEn: `Launching "${app.name}" (PID ${pid}, ${app.arch}) inside ${app.prefixId}.`,
        },
        ...prev.logs,
      ],
    }));
    setRunningApp(app);
  };

  const handleTerminateApp = () => {
    if (runningApp) {
      setSystemState((prev) => ({
        ...prev,
        processes: prev.processes.filter((p) => p.appId !== runningApp.id),
        logs: [
          {
            id: `log-${Date.now()}`,
            timestamp: getTimeString(),
            module: 'WineWoW64',
            level: 'INFO',
            messageId: `Sesi "${runningApp.name}" dihentikan aman melalui wineserver -k.`,
            messageEn: `Session "${runningApp.name}" terminated safely via wineserver -k.`,
          },
          ...prev.logs,
        ],
      }));
    }
    setRunningApp(null);
  };

  const handleTerminateProcessByPid = (pid: number, force = false) => {
    setSystemState((prev) => {
      const target = prev.processes.find((p) => p.pid === pid);
      if (runningApp && target && runningApp.id === target.appId) {
        setRunningApp(null);
      }
      return {
        ...prev,
        processes: prev.processes.filter((p) => p.pid !== pid),
        logs: target
          ? [
              {
                id: `log-${Date.now()}`,
                timestamp: getTimeString(),
                module: 'WineWoW64',
                level: force ? 'WARN' : 'INFO',
                messageId: `Proses ${target.appName} (PID ${pid}) dihentikan (${force ? 'SIGKILL' : 'wineserver -k'}).`,
                messageEn: `Process ${target.appName} (PID ${pid}) stopped (${force ? 'SIGKILL' : 'wineserver -k'}).`,
              },
              ...prev.logs,
            ]
          : prev.logs,
      };
    });
  };

  const handleToggleComponent = (componentId: string) => {
    setSystemState((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.id === componentId && !c.essential ? { ...c, installed: !c.installed } : c
      ),
    }));
  };

  const handleRepairPrefix = async (prefixId: string) => {
    await fetch(`/api/prefixes/${encodeURIComponent(prefixId)}/repair`, { method: 'POST' });
    setSystemState((prev) => ({
      ...prev,
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'PrefixMgr',
          level: 'INFO',
          messageId: `Struktur disk & registry hive pada prefix ${prefixId} diperbarui.`,
          messageEn: `Disk directories & registry hives repaired inside prefix ${prefixId}.`,
        },
        ...prev.logs,
      ],
    }));
  };

  const handleTogglePrefixDep = async (prefixId: string, depId: string) => {
    const existingPfx = systemState.prefixes.find((p) => p.id === prefixId);
    const exists = existingPfx?.installedDeps.includes(depId) ?? false;
    const action = exists ? 'remove' : 'install';

    setSystemState((prev) => ({
      ...prev,
      prefixes: prev.prefixes.map((p) => {
        if (p.id !== prefixId) return p;
        return {
          ...p,
          installedDeps: exists
            ? p.installedDeps.filter((d) => d !== depId)
            : [...p.installedDeps, depId],
        };
      }),
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'PrefixMgr',
          level: 'INFO',
          messageId: `Dependensi ${depId} (${action}) disinkronkan ke drive_c & user.reg pada prefix ${prefixId}.`,
          messageEn: `Dependency ${depId} (${action}) synced to drive_c & user.reg inside prefix ${prefixId}.`,
        },
        ...prev.logs,
      ],
    }));

    try {
      await fetch(`/api/prefixes/${encodeURIComponent(prefixId)}/deps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depId, action }),
      });
    } catch {
      // state sync fallback handles persistence
    }
  };

  const handleInstallPlugin = (plugin: InstalledPlugin) => {
    setSystemState((prev) => ({
      ...prev,
      plugins: [plugin, ...prev.plugins.filter((p) => p.id !== plugin.id)],
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'PluginHost',
          level: 'INFO',
          messageId: `Plugin "${plugin.name}" v${plugin.version} (${plugin.category}) divalidasi & diekstrak.`,
          messageEn: `Plugin "${plugin.name}" v${plugin.version} (${plugin.category}) validated & unpacked.`,
        },
        ...prev.logs,
      ],
    }));
  };

  const handleTogglePlugin = (pluginId: string) => {
    setSystemState((prev) => ({
      ...prev,
      plugins: prev.plugins.map((p) => (p.id === pluginId ? { ...p, enabled: !p.enabled } : p)),
    }));
  };

  const handleDeletePlugin = (pluginId: string) => {
    setSystemState((prev) => ({
      ...prev,
      plugins: prev.plugins.filter((p) => p.id !== pluginId),
    }));
  };

  const handlePluginSandboxEffect = (
    plugin: InstalledPlugin,
    result: PluginSandboxExecutionResult
  ) => {
    setSystemState((prev) => {
      let nextPlugins = prev.plugins;
      if (result.appliedAccentColor) {
        nextPlugins = prev.plugins.map((p) =>
          p.id === plugin.id
            ? { ...p, accentColor: result.appliedAccentColor, enabled: true }
            : p
        );
      }
      const nextApps =
        result.suggestedEnv && Object.keys(result.suggestedEnv).length > 0
          ? prev.apps.map((a) => ({
              ...a,
              envVars: { ...a.envVars, ...result.suggestedEnv },
            }))
          : prev.apps;

      const summary = result.logs.map((l) => `[${l.level}] ${l.message}`).join(' · ');
      return {
        ...prev,
        plugins: nextPlugins,
        apps: nextApps,
        logs: [
          {
            id: `log-${Date.now()}`,
            timestamp: getTimeString(),
            module: 'PluginHost',
            level: result.ok ? 'INFO' : 'WARN',
            messageId: `Sandbox ${plugin.name} (${result.durationMs}ms): ${summary || 'Selesai'}`,
            messageEn: `Sandbox ${plugin.name} (${result.durationMs}ms): ${summary || 'Done'}`,
          },
          ...prev.logs,
        ],
      };
    });
  };

  const handleSaveKeyboardPreset = (preset: KeyboardPresetConfig) => {
    setSystemState((prev) => {
      const exists = prev.keyboardPresets.some((k) => k.id === preset.id);
      return {
        ...prev,
        keyboardPresets: exists
          ? prev.keyboardPresets.map((k) => (k.id === preset.id ? preset : k))
          : [preset, ...prev.keyboardPresets],
      };
    });
  };

  const handleUpdateGlobalConfig = (cfg: GlobalRuntimeConfig) => {
    setSystemState((prev) => ({
      ...prev,
      globalConfig: cfg,
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'Box64',
          level: 'INFO',
          messageId: `Konfigurasi global diperbarui (BIGBLOCK=${cfg.box64BigBlock}, STRONGMEM=${cfg.box64StrongMem}).`,
          messageEn: `Updated global runtime config (BIGBLOCK=${cfg.box64BigBlock}, STRONGMEM=${cfg.box64StrongMem}).`,
        },
        ...prev.logs,
      ],
    }));
  };

  const handleInjectSampleLog = () => {
    setSystemState((prev) => ({
      ...prev,
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: getTimeString(),
          module: 'Box64',
          level: 'ERROR',
          messageId: 'VCRUNTIME140_1.dll tidak ditemukan di prefix pfx-vscode.',
          messageEn: 'Missing VCRUNTIME140_1.dll inside prefix pfx-vscode.',
          hintId: 'Saran: Pasang dependensi vcrun2022 melalui Admin Panel -> Dependency Manager.',
          hintEn: 'Suggestion: Install vcrun2022 via Admin Panel -> Dependency Manager.',
        },
        ...prev.logs,
      ],
    }));
  };

  const handleResetWorkspace = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const fresh = (await res.json()) as WPhoneSystemState;
        setSystemState(fresh);
      } else {
        setSystemState(createInitialSystemState());
      }
    } catch {
      setSystemState(createInitialSystemState());
    }
    setProtoView('wizard');
    setActiveSection('console');
  };

  const device = useMemo(
    () =>
      DEVICE_PROFILES.find((d) => d.id === systemState.deviceProfileId) ||
      DEVICE_PROFILES[0],
    [systemState.deviceProfileId]
  );

  const primaryActionLabel =
    activeSection === 'console' && protoView === 'library'
      ? t.cta.runWizard
      : t.cta.openLibrary;

  const handlePrimaryAction = () => {
    setActiveSection('console');
    if (protoView === 'library') {
      setProtoView('wizard');
    } else {
      setProtoView('library');
    }
  };

  const renderPrototypeBody = (compact: boolean) => {
    if (protoView === 'wizard') {
      return (
        <SetupWizard
          systemState={systemState}
          lang={resolvedLang}
          onComplete={handleCompleteWizard}
          onCancelToLibrary={() => setProtoView('library')}
        />
      );
    }
    if (protoView === 'keyboard') {
      return (
        <KeyboardStudio
          presets={systemState.keyboardPresets}
          lang={resolvedLang}
          onSavePreset={handleSaveKeyboardPreset}
        />
      );
    }
    if (protoView === 'admin') {
      return (
        <AdminPanel
          systemState={systemState}
          lang={resolvedLang}
          onReRunWizard={() => setProtoView('wizard')}
          onToggleComponent={handleToggleComponent}
          onUnregisterApp={handleUnregisterApp}
          onRepairPrefix={handleRepairPrefix}
          onTogglePrefixDep={(pfxId, depId) => void handleTogglePrefixDep(pfxId, depId)}
          onTerminateProcess={handleTerminateProcessByPid}
          onInstallPlugin={handleInstallPlugin}
          onTogglePlugin={handleTogglePlugin}
          onDeletePlugin={handleDeletePlugin}
          onPluginSandboxEffect={handlePluginSandboxEffect}
          onUpdateGlobalConfig={handleUpdateGlobalConfig}
          onInjectSampleLog={handleInjectSampleLog}
          onClearLogs={() => setSystemState((prev) => ({ ...prev, logs: [] }))}
        />
      );
    }
    return (
      <AppLibrary
        apps={systemState.apps}
        lang={resolvedLang}
        compactFrame={compact}
        onLaunchApp={handleLaunchApp}
        onToggleSafeMode={(appId) =>
          setSystemState((prev) => ({
            ...prev,
            apps: prev.apps.map((a) =>
              a.id === appId ? { ...a, box64SafeMode: !a.box64SafeMode } : a
            ),
          }))
        }
        onEditApp={(app) => {
          setEditingApp(app);
          setAddModalOpen(true);
        }}
        onUnregisterApp={handleUnregisterApp}
        onOpenAddModal={() => {
          setEditingApp(null);
          setAddModalOpen(true);
        }}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenHelper={() => setHelperOpen(true)}
        onPrimaryAction={handlePrimaryAction}
        primaryActionLabel={primaryActionLabel}
        viewportMode={viewportMode}
        onViewportChange={setViewportMode}
        themePref={themePref}
        onThemeChange={setThemePref}
        langPref={langPref}
        onLangChange={setLangPref}
        resolvedLang={resolvedLang}
        onResetDemo={() => void handleResetWorkspace()}
      />

      {activeFrontendAccent && (
        <div
          className="text-white text-xs py-1.5 px-4 text-center font-medium"
          style={{ backgroundColor: activeFrontendAccent }}
        >
          {resolvedLang === 'id'
            ? 'Plugin Frontend Aktif: Tema Aksen Diterapkan melalui API wphone.frontend@1.0'
            : 'Active Frontend Plugin: Accent Override Applied via wphone.frontend@1.0'}
        </div>
      )}

      <main className="flex-1">
        {activeSection === 'console' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {viewportMode === 'mobile' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: Android Phone Frame */}
                <div className="lg:col-span-6 xl:col-span-5 flex justify-center">
                  <div className="w-full max-w-[420px] rounded-[28px] border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] shadow-xl overflow-hidden flex flex-col h-[760px]">
                    <div className="h-12 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <WPhoneIcon variant="launcher" className="w-6 h-6" alt="WPhone" />
                        <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          WPhone Android
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        WoW64 · Box64
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto">{renderPrototypeBody(true)}</div>

                    <nav className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setProtoView('library')}
                        className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                          protoView === 'library'
                            ? 'text-[#0078D4] dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <AppWindow className="w-4 h-4" />
                        <span>{t.protoNav.library}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProtoView('admin')}
                        className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                          protoView === 'admin'
                            ? 'text-[#0078D4] dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Sliders className="w-4 h-4" />
                        <span>Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProtoView('keyboard')}
                        className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                          protoView === 'keyboard'
                            ? 'text-[#0078D4] dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Keyboard className="w-4 h-4" />
                        <span>Keys</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProtoView('wizard')}
                        className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                          protoView === 'wizard'
                            ? 'text-[#0078D4] dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Wrench className="w-4 h-4" />
                        <span>{t.protoNav.wizard}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHelperOpen(true)}
                        className="min-h-[44px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>{t.protoNav.helper}</span>
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Right: Live System Context */}
                <div className="lg:col-span-6 xl:col-span-7 space-y-5">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <WPhoneIcon variant="internal" className="w-9 h-9" alt="WPhone Engine" />
                      <div>
                        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          {resolvedLang === 'id'
                            ? 'Platform Full-Stack WPhone + Kode Native Android'
                            : 'WPhone Full-Stack Platform + Native Android Codebase'}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {device.name} · {device.gpuName} · {systemState.apps.length}{' '}
                          {resolvedLang === 'id' ? 'aplikasi terdaftar' : 'registered apps'}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {resolvedLang === 'id'
                        ? 'Didukung server backend Express untuk inspeksi biner Windows PE32/PE32+ nyata, manajemen berkas & Wine prefix langsung di disk, ekstraksi plugin .wrplugin ZIP, serta ekspor proyek Android Studio Kotlin/Compose/C++ JNI.'
                        : 'Powered by an Express backend for real Windows PE32/PE32+ binary inspection, disk-backed file & Wine prefix provisioning, .wrplugin ZIP unpacking, and complete Android Studio Kotlin/Compose/C++ JNI project export.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveSection('android')}
                        className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#0078D4] transition-colors space-y-1"
                      >
                        <FolderGit2 className="w-4 h-4 text-[#0078D4]" />
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          Android Studio Multi-Module (.zip)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Kotlin · Jetpack Compose · CMake C++ JNI · AAudio
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection('docs')}
                        className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#0078D4] transition-colors space-y-1"
                      >
                        <BookOpen className="w-4 h-4 text-[#0078D4]" />
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          12 Engineering Docs
                        </div>
                        <div className="text-[11px] text-slate-500">
                          PRD, Architecture, ADR & Security
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection('compatibility')}
                        className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#0078D4] transition-colors space-y-1"
                      >
                        <Layers className="w-4 h-4 text-[#0078D4]" />
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          Wine WoW64 + Box64
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {resolvedLang === 'id'
                            ? 'Matriks lisensi & .wrplugin'
                            : 'License matrix & .wrplugin spec'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHelperOpen(true)}
                        className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#0078D4] transition-colors space-y-1"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#0078D4]" />
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {t.nav.helper} (ID / EN)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {resolvedLang === 'id'
                            ? 'Panduan & pemecahan masalah'
                            : 'Guides & troubleshooting'}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Expanded Tablet / Desktop Workspace Layout */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setProtoView('library')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        protoView === 'library'
                          ? 'bg-[#0078D4] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <AppWindow className="w-4 h-4" />
                      <span>{t.protoNav.library}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtoView('admin')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        protoView === 'admin'
                          ? 'bg-[#0078D4] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Sliders className="w-4 h-4" />
                      <span>{t.protoNav.admin}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtoView('keyboard')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        protoView === 'keyboard'
                          ? 'bg-[#0078D4] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Keyboard className="w-4 h-4" />
                      <span>{t.protoNav.keyboard}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtoView('wizard')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        protoView === 'wizard'
                          ? 'bg-[#0078D4] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>{t.protoNav.wizard}</span>
                    </button>
                  </div>

                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {device.name} · Wine WoW64 + Box64
                  </div>
                </div>

                {renderPrototypeBody(false)}
              </div>
            )}
          </div>
        )}

        {activeSection === 'android' && <AndroidProjectView lang={resolvedLang} />}

        {activeSection === 'docs' && <DocsPortal lang={resolvedLang} />}

        {activeSection === 'compatibility' && <CompatibilityView lang={resolvedLang} />}
      </main>

      <AddAppModal
        key={editingApp ? editingApp.id : addModalOpen ? 'new-open' : 'closed'}
        open={addModalOpen}
        editingApp={editingApp}
        lang={resolvedLang}
        onClose={() => {
          setAddModalOpen(false);
          setEditingApp(null);
        }}
        onSaveApp={handleSaveApp}
      />

      <AppRuntimeOverlay
        app={runningApp}
        deviceProfileId={systemState.deviceProfileId}
        keyboardPresets={systemState.keyboardPresets}
        lang={resolvedLang}
        onTerminate={handleTerminateApp}
        onRefreshState={() => {
          fetch('/api/state')
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh: WPhoneSystemState | null) => {
              if (fresh && Array.isArray(fresh.apps)) setSystemState(fresh);
            });
        }}
      />

      <HelperDrawer
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        lang={resolvedLang}
      />
    </div>
  );
}
