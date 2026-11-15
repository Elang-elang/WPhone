import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUp,
  Code2,
  Cpu,
  Download,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Layers,
  Lock,
  PackageCheck,
  Play,
  Power,
  Puzzle,
  RefreshCw,
  Save,
  ShieldAlert,
  Sliders,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DiagnosticLogEntry,
  GlobalRuntimeConfig,
  InstalledPlugin,
  ManagedProcess,
  PluginSandboxExecutionResult,
  ResolvedLanguage,
  SystemTelemetry,
  VirtualFsNode,
  WPhoneSystemState,
} from '../types/wphone';
import { translations, verificationLabel } from '../i18n/translations';
import { DEPENDENCY_CATALOG, DEVICE_PROFILES } from '../data/mockData';
import { executePluginInSandbox } from '../utils/pluginSandbox';

interface AdminPanelProps {
  systemState: WPhoneSystemState;
  lang: ResolvedLanguage;
  onReRunWizard: () => void;
  onToggleComponent: (componentId: string) => void;
  onUnregisterApp: (appId: string) => void;
  onRepairPrefix: (prefixId: string) => Promise<void> | void;
  onTogglePrefixDep: (prefixId: string, depId: string) => void;
  onTerminateProcess: (pid: number, force?: boolean) => void;
  onInstallPlugin: (plugin: InstalledPlugin) => void;
  onTogglePlugin: (pluginId: string) => void;
  onDeletePlugin: (pluginId: string) => void;
  onPluginSandboxEffect?: (plugin: InstalledPlugin, result: PluginSandboxExecutionResult) => void;
  onUpdateGlobalConfig: (cfg: GlobalRuntimeConfig) => void;
  onInjectSampleLog: () => void;
  onClearLogs: () => void;
}

type AdminTab =
  | 'dashboard'
  | 'cmd'
  | 'files'
  | 'apps'
  | 'runtime'
  | 'deps'
  | 'processes'
  | 'plugins'
  | 'config'
  | 'logs';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  systemState,
  lang,
  onReRunWizard,
  onToggleComponent,
  onUnregisterApp,
  onRepairPrefix,
  onTogglePrefixDep,
  onTerminateProcess,
  onInstallPlugin,
  onTogglePlugin,
  onDeletePlugin,
  onPluginSandboxEffect,
  onUpdateGlobalConfig,
  onInjectSampleLog,
  onClearLogs,
}) => {
  const t = translations[lang].admin;
  const [tab, setTab] = useState<AdminTab>('dashboard');

  // Real Disk File Manager State
  const [currentPath, setCurrentPath] = useState('/WPhone');
  const [diskNodes, setDiskNodes] = useState<VirtualFsNode[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileEditorContent, setFileEditorContent] = useState<string>('');
  const [fileIsBinary, setFileIsBinary] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);
  const [fsSuccess, setFsSuccess] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const fsUploadRef = useRef<HTMLInputElement>(null);

  // Dependency Manager selected prefix
  const [selectedDepPrefixId, setSelectedDepPrefixId] = useState<string>(
    systemState.prefixes[0]?.id || ''
  );

  // Plugin Manager upload, script inspector & live Worker sandbox
  const pluginUploadRef = useRef<HTMLInputElement>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [pluginNotice, setPluginNotice] = useState<string | null>(null);
  const [inspectedPluginId, setInspectedPluginId] = useState<string | null>(null);
  const [pluginScriptDraft, setPluginScriptDraft] = useState<string>('');
  const [sandboxOutput, setSandboxOutput] = useState<PluginSandboxExecutionResult | null>(null);
  const [runningSandbox, setRunningSandbox] = useState(false);

  // Global Config Draft
  const [cfgDraft, setCfgDraft] = useState<GlobalRuntimeConfig>({ ...systemState.globalConfig });
  const [cfgSaved, setCfgSaved] = useState(false);

  // Logs Filter
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');

  // Windows Task Manager Live Telemetry & Admin CMD Shell
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [cmdInput, setCmdInput] = useState('ver');
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdOutput, setCmdOutput] = useState(
    'WPhone Windows / Distro Admin CMD Shell ready.\nType "help", "ver", "dir /WPhone/prefixes", "reg query pfx-notepadpp", or "logs".'
  );

  useEffect(() => {
    let active = true;
    const poll = () => {
      fetch('/api/telemetry')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SystemTelemetry | null) => {
          if (active && data) setTelemetry(data);
        })
        .catch(() => {});
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const runAdminCmd = async (commandText: string) => {
    const trimmed = commandText.trim();
    if (!trimmed || cmdRunning) return;
    if (trimmed.toLowerCase() === 'clear') {
      setCmdOutput('');
      return;
    }
    setCmdRunning(true);
    try {
      const res = await fetch('/api/cmd/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
      });
      const data = (await res.json()) as { exitCode: number; output: string };
      setCmdOutput((prev) => `${prev ? prev + '\n\n' : ''}$ ${trimmed}\n${data.output}\n[exit ${data.exitCode}]`);
    } catch {
      setCmdOutput((prev) => `${prev}\n[error] Failed to reach /api/cmd/exec`);
    } finally {
      setCmdRunning(false);
    }
  };

  const device = useMemo(
    () =>
      DEVICE_PROFILES.find((d) => d.id === systemState.deviceProfileId) ||
      DEVICE_PROFILES[0],
    [systemState.deviceProfileId]
  );

  const installedComponents = useMemo(
    () => systemState.components.filter((c) => c.installed),
    [systemState.components]
  );

  const totalRuntimeMb = useMemo(
    () => installedComponents.reduce((sum, c) => sum + c.sizeMb, 0),
    [installedComponents]
  );

  const totalPrefixMb = useMemo(
    () => systemState.prefixes.reduce((sum, p) => sum + p.sizeMb, 0),
    [systemState.prefixes]
  );

  const fetchDiskDir = async (targetPath: string) => {
    setFsLoading(true);
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(targetPath)}`);
      const data = (await res.json()) as { nodes?: VirtualFsNode[] };
      setDiskNodes(data.nodes || []);
    } catch {
      setDiskNodes([]);
    } finally {
      setFsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'files') {
      void fetchDiskDir(currentPath);
    }
  }, [tab, currentPath]);

  const handleOpenDiskFile = async (vPath: string) => {
    setFsError(null);
    setFsSuccess(null);
    const res = await fetch(`/api/fs/read?path=${encodeURIComponent(vPath)}`);
    const data = (await res.json()) as {
      binary?: boolean;
      content?: string;
      error?: string;
    };
    if (!res.ok) {
      setFsError(data.error || 'Failed to read file');
      return;
    }
    setSelectedFilePath(vPath);
    setFileIsBinary(Boolean(data.binary));
    setFileEditorContent(data.content || '');
  };

  const handleSaveDiskFile = async () => {
    if (!selectedFilePath || fileIsBinary) return;
    const res = await fetch('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFilePath, content: fileEditorContent }),
    });
    if (res.ok) {
      setFsSuccess(
        lang === 'id' ? `Berkas ${selectedFilePath} disimpan ke disk.` : `Saved ${selectedFilePath} to disk.`
      );
      void fetchDiskDir(currentPath);
    }
  };

  const handleCreateDiskFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newFolderName.trim().replace(/[/\\]/g, '');
    if (!cleaned) return;
    const res = await fetch('/api/fs/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath: currentPath, name: cleaned }),
    });
    if (res.ok) {
      setNewFolderName('');
      setFsError(null);
      void fetchDiskDir(currentPath);
    }
  };

  const handleUploadDiskFile = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('targetDir', currentPath);
    const res = await fetch('/api/fs/upload', { method: 'POST', body: form });
    if (res.ok) {
      setFsSuccess(
        lang === 'id'
          ? `Berkas "${file.name}" diunggah ke ${currentPath}.`
          : `Uploaded "${file.name}" to ${currentPath}.`
      );
      void fetchDiskDir(currentPath);
    }
  };

  const handleDeleteDiskNode = async (node: VirtualFsNode) => {
    setFsError(null);
    setFsSuccess(null);
    const res = await fetch(`/api/fs/node?path=${encodeURIComponent(node.path)}`, {
      method: 'DELETE',
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setFsError(data.error || t.files.cannotDeleteProtected);
      return;
    }
    if (selectedFilePath === node.path) setSelectedFilePath(null);
    void fetchDiskDir(currentPath);
  };

  const handleUploadPlugin = async (file: File) => {
    setPluginError(null);
    setPluginNotice(null);
    const form = new FormData();
    form.append('plugin', file);
    const res = await fetch('/api/plugins/upload', { method: 'POST', body: form });
    const data = (await res.json()) as { plugin?: InstalledPlugin; error?: string };
    if (!res.ok || !data.plugin) {
      setPluginError(data.error || 'Failed to unpack .wrplugin archive');
      return;
    }
    onInstallPlugin(data.plugin);
    setPluginNotice(
      lang === 'id'
        ? `Plugin "${data.plugin.name}" terpasang (status nonaktif hingga izin Anda tinjau).`
        : `Installed "${data.plugin.name}" (disabled until you review permissions).`
    );
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'ALL') return systemState.logs;
    return systemState.logs.filter((l) => l.level === logFilter);
  }, [systemState.logs, logFilter]);

  const activeDepPrefix =
    systemState.prefixes.find((p) => p.id === selectedDepPrefixId) || systemState.prefixes[0];

  const box64Installed = installedComponents.some((c) => c.id === 'box64');
  const wineInstalled = installedComponents.some((c) => c.id === 'wine-wow64');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {t.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onReRunWizard}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.dashboard.rerunWizard}</span>
        </button>
      </div>

      {/* All 9 Admin Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'dashboard', label: t.tabs.dashboard },
            { id: 'cmd', label: t.tabs.cmd },
            { id: 'files', label: t.tabs.files },
            { id: 'apps', label: t.tabs.apps },
            { id: 'runtime', label: t.tabs.runtime },
            { id: 'deps', label: t.tabs.deps },
            { id: 'processes', label: `${t.tabs.processes} (${systemState.processes.length})` },
            { id: 'plugins', label: `${t.tabs.plugins} (${systemState.plugins.length})` },
            { id: 'config', label: t.tabs.config },
            { id: 'logs', label: t.tabs.logs },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === item.id
                ? 'bg-[#0078D4] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 1. DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.dashboard.systemStatus}</span>
              </div>
              <div className="font-display text-base font-bold text-slate-900 dark:text-white">
                {systemState.initialized
                  ? lang === 'id'
                    ? 'Terkelola & Siap'
                    : 'Managed & Ready'
                  : lang === 'id'
                    ? 'Menunggu Setup'
                    : 'Pending Setup'}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Wine WoW64 + Box64 · {systemState.setupMode.toUpperCase()}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0078D4]" />
                <span>{t.dashboard.cpuRamStorage}</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {device.ramGb} GB RAM · {device.cores}c ARM64
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {device.gpuName} · Vulkan {device.vulkanVersion}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#0078D4]" />
                <span>{t.dashboard.installedSummary}</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {installedComponents.length} runtime · {systemState.prefixes.length} prefix
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                {totalRuntimeMb + totalPrefixMb} MB allocated
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Puzzle className="w-3.5 h-3.5 text-[#0078D4]" />
                <span>Processes & Plugins</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {systemState.processes.length} active ·{' '}
                {systemState.plugins.filter((p) => p.enabled).length} plugins
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Server Disk Workspace Synced
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Windows Task Manager · Live Host & Container Resources
              </h3>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                Uptime: {telemetry?.uptimeSec ?? 0}s · Workspace: {telemetry?.workspaceMb ?? 1} MB
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="text-slate-600 dark:text-slate-300">CPU Utilization</span>
                  <span className="font-bold text-[#0078D4] dark:text-sky-400">{telemetry?.cpuPercent ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#0078D4] dark:bg-sky-400 transition-all"
                    style={{ width: `${telemetry?.cpuPercent ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="text-slate-600 dark:text-slate-300">Memory Used</span>
                  <span className="font-bold text-[#0078D4] dark:text-sky-400">
                    {telemetry ? `${telemetry.ramUsedMb} / ${telemetry.ramTotalMb} MB` : 'Loading...'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: telemetry
                        ? `${Math.min(100, Math.round((telemetry.ramUsedMb / Math.max(1, telemetry.ramTotalMb)) * 100))}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.runtimeStack}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  CPU & Windows API Layer
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  Windows PE (x86/x64) → Wine 9.21 WoW64 → Box64 0.3.2 → ARM64 Kernel
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  Graphics & Audio Bridges
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  DXVK / VKD3D → {device.turnipSupported ? 'Mesa Turnip' : 'System Vulkan'} · PulseAudio → AAudio
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1B. ADMIN CMD SHELL */}
      {tab === 'cmd' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
              <Terminal className="w-4 h-4 text-[#0078D4] dark:text-sky-400" />
              <span>WPhone Admin CMD Shell (Distro & Wine Prefix Inspector)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'ver',
                'box64 --version',
                'dir /WPhone/prefixes',
                'reg query pfx-notepadpp',
                'env',
                'ps',
                'logs',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCmdInput(preset);
                    void runAdminCmd(preset);
                  }}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 font-mono text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAdminCmd(cmdInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="help, ver, dir /WPhone/prefixes, reg query pfx-notepadpp, cat /WPhone/config/global_runtime.json"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={cmdRunning}
              className="px-4 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white font-semibold"
            >
              {cmdRunning ? '...' : 'Execute'}
            </button>
          </form>

          <pre className="p-3.5 rounded-lg bg-[#050811] border border-slate-800 text-sky-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
            {cmdOutput}
          </pre>
        </div>
      )}

      {/* 2. REAL DISK FILE MANAGER */}
      {tab === 'files' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (currentPath === '/WPhone') return;
                    const parent =
                      currentPath.slice(0, currentPath.lastIndexOf('/')) || '/WPhone';
                    setCurrentPath(parent);
                    setSelectedFilePath(null);
                    setFsError(null);
                  }}
                  disabled={currentPath === '/WPhone'}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>{t.files.upLevel}</span>
                </button>
                <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">
                  {currentPath}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fsUploadRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadDiskFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fsUploadRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.files.uploadFile}</span>
                </button>

                <form onSubmit={handleCreateDiskFolder} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={t.files.newFolder}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0078D4] text-white text-xs font-medium"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{t.files.newFolder}</span>
                  </button>
                </form>
              </div>
            </div>

            {fsError && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{fsError}</span>
              </div>
            )}

            {fsSuccess && (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                {fsSuccess}
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {fsLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Reading disk...</div>
              ) : diskNodes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {lang === 'id' ? 'Direktori kosong.' : 'Directory is empty.'}
                </div>
              ) : (
                diskNodes.map((node) => (
                  <div
                    key={node.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (node.type === 'folder') {
                          setCurrentPath(node.path);
                          setSelectedFilePath(null);
                          setFsError(null);
                          setFsSuccess(null);
                        } else {
                          void handleOpenDiskFile(node.path);
                        }
                      }}
                      className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                    >
                      {node.type === 'folder' ? (
                        <Folder className="w-4 h-4 text-[#0078D4] shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-100 truncate">
                        {node.name}
                      </span>
                      {node.protected && (
                        <span
                          title={t.files.protectedBadge}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 shrink-0"
                        >
                          <Lock className="w-3 h-3" />
                          <span className="hidden sm:inline">{t.files.protectedBadge}</span>
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {node.type === 'folder' ? 'DIR' : `${node.sizeKb} KB`}
                      </span>
                      {node.type === 'file' && (
                        <a
                          href={`/api/fs/download?path=${encodeURIComponent(node.path)}`}
                          title={t.files.download}
                          className="p-1.5 rounded-md text-slate-400 hover:text-[#0078D4]"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteDiskNode(node)}
                        title={t.files.delete}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedFilePath && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {t.files.previewTitle}: <span className="font-mono">{selectedFilePath}</span>
                  </span>
                  {!fileIsBinary && (
                    <button
                      type="button"
                      onClick={() => void handleSaveDiskFile()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] text-white font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{t.files.saveEdit}</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  readOnly={fileIsBinary}
                  value={fileEditorContent}
                  onChange={(e) => setFileEditorContent(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs border border-slate-800"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. APPLICATION MANAGER */}
      {tab === 'apps' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {systemState.apps.map((app) => {
            const pfx = systemState.prefixes.find((p) => p.id === app.prefixId);
            return (
              <div
                key={app.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                    {app.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    {pfx?.path || `/WPhone/prefixes/${app.prefixId}`} · {app.arch} ·{' '}
                    {pfx?.winVersion || 'win10'}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                    {t.apps.prefixSize}: {pfx?.sizeMb ?? 120} MB · {t.apps.depsCount}:{' '}
                    {pfx?.installedDeps.length ? pfx.installedDeps.join(', ') : 'None'}
                  </div>
                  {app.importedDlls && app.importedDlls.length > 0 && (
                    <div className="font-mono text-[11px] text-slate-400 truncate">
                      PE Imports: {app.importedDlls.join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void onRepairPrefix(app.prefixId)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.apps.repairPrefix}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUnregisterApp(app.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {translations[lang].library.unregister}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. RUNTIME MANAGER */}
      {tab === 'runtime' && (
        <div className="space-y-3">
          {(!box64Installed || !wineInstalled) && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t.runtime.compatWarning}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Layers className="w-4 h-4 text-[#0078D4]" />
              <span>{t.runtime.totalFootprint}</span>
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {totalRuntimeMb} MB
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {systemState.components.map((comp) => (
              <div
                key={comp.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                      {comp.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {comp.version} · {comp.license} · {comp.sizeMb} MB
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {lang === 'id' ? comp.descriptionId : comp.descriptionEn}
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {comp.archSupport} · {verificationLabel(comp.verification, lang)}
                  </div>
                </div>

                <div className="shrink-0">
                  {comp.essential ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.runtime.essentialLock}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleComponent(comp.id)}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                        comp.installed
                          ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'bg-[#0078D4] hover:bg-[#006CBE] text-white'
                      }`}
                    >
                      {comp.installed ? t.runtime.remove : t.runtime.install}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. DEPENDENCY MANAGER */}
      {tab === 'deps' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <PackageCheck className="w-4 h-4 text-[#0078D4]" />
              <span>
                {lang === 'id'
                  ? 'Pilih Prefix Target untuk Audit & Pasang Dependensi:'
                  : 'Select Target Prefix for Dependency Audit:'}
              </span>
            </div>
            <select
              value={activeDepPrefix?.id || ''}
              onChange={(e) => setSelectedDepPrefixId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
            >
              {systemState.prefixes.map((p) => {
                const app = systemState.apps.find((a) => a.prefixId === p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.id} ({app?.name || 'Unlinked'})
                  </option>
                );
              })}
            </select>
          </div>

          {activeDepPrefix && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {DEPENDENCY_CATALOG.map((dep) => {
                const installed = activeDepPrefix.installedDeps.includes(dep.id);
                const linkedApp = systemState.apps.find((a) => a.prefixId === activeDepPrefix.id);
                const neededByPe = linkedApp?.importedDlls?.some((dll) =>
                  dep.triggeredByDlls.includes(dll.toLowerCase())
                );
                return (
                  <div
                    key={dep.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {dep.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {dep.sizeMb} MB · {dep.license}
                        </span>
                        {neededByPe && !installed && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            {lang === 'id' ? 'Terdeteksi hilang dari PE Imports' : 'Detected missing via PE Imports'}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {lang === 'id' ? dep.descriptionId : dep.descriptionEn}
                      </p>
                      <div className="font-mono text-[11px] text-slate-400">
                        DLLs: {dep.triggeredByDlls.join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onTogglePrefixDep(activeDepPrefix.id, dep.id)}
                      className={`px-3.5 py-2 rounded-lg font-semibold shrink-0 ${
                        installed
                          ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          : 'bg-[#0078D4] text-white'
                      }`}
                    >
                      {installed
                        ? lang === 'id'
                          ? 'Hapus dari Prefix'
                          : 'Remove from Prefix'
                        : lang === 'id'
                          ? 'Pasang ke Prefix'
                          : 'Install to Prefix'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. PROCESS MANAGER */}
      {tab === 'processes' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {systemState.processes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                {lang === 'id'
                  ? 'Tidak ada proses Windows yang sedang berjalan'
                  : 'No active Windows processes running'}
              </div>
              <p>
                {lang === 'id'
                  ? 'Jalankan aplikasi dari Library untuk memantau PID, memori, dan penghentian wineserver secara aman.'
                  : 'Launch an app from Library to monitor PID, RAM footprint, and graceful wineserver termination.'}
              </p>
            </div>
          ) : (
            systemState.processes.map((proc: ManagedProcess) => (
              <div
                key={proc.pid}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0078D4] dark:text-sky-400 tabular-nums">
                      PID {proc.pid}
                    </span>
                    <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {proc.appName}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    {proc.commandLine}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                    CPU: {proc.cpuPercent}% · RAM: {proc.ramMb} MB · Prefix: {proc.prefixId} · Started {proc.startedAt}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTerminateProcess(proc.pid, false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>wineserver -k</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTerminateProcess(proc.pid, true)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                  >
                    Force Kill
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 7. REAL .WRPLUGIN MANAGER */}
      {tab === 'plugins' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'id'
                  ? 'Manajer Paket Plugin (.wrplugin ZIP)'
                  : 'Plugin Package Manager (.wrplugin ZIP)'}
              </div>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'id'
                  ? 'Memeriksa plugin.json / plugin.toml di root ZIP, SHA-256, izin, serta menerapkan plugin tema frontend secara langsung.'
                  : 'Validates root plugin.json / plugin.toml inside ZIP, SHA-256 integrity, permissions, and executes live frontend theme plugins.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/plugins/sample-wrplugin"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {lang === 'id' ? 'Unduh Contoh .wrplugin' : 'Download Sample .wrplugin'}
                </span>
              </a>
              <input
                ref={pluginUploadRef}
                type="file"
                accept=".wrplugin,.zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadPlugin(f);
                }}
              />
              <button
                type="button"
                onClick={() => pluginUploadRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{lang === 'id' ? 'Pasang .wrplugin' : 'Install .wrplugin'}</span>
              </button>
            </div>
          </div>

          {pluginError && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300"
            >
              {pluginError}
            </div>
          )}

          {pluginNotice && (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              {pluginNotice}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {systemState.plugins.map((plg) => (
              <div
                key={plg.id}
                className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {plg.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      v{plg.version} · {plg.category} · {plg.scriptLanguage} · {plg.apiVersion}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{plg.description}</p>
                  <div className="font-mono text-[11px] text-slate-500">
                    Permissions: {plg.permissions.join(', ')} · SHA-256: {plg.sha256.slice(0, 16)}…
                  </div>
                  {plg.category === 'backend' && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {lang === 'id'
                          ? 'Plugin Backend memiliki hak akses konfigurasi runtime; aktifkan hanya dari sumber terpercaya.'
                          : 'Backend plugins modify runtime environment settings; enable only from trusted authors.'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      setInspectedPluginId(plg.id);
                      setSandboxOutput(null);
                      const res = await fetch(`/api/plugins/${encodeURIComponent(plg.id)}/script`);
                      const data = (await res.json()) as { content?: string };
                      setPluginScriptDraft(data.content || plg.scriptPreview || '');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Skrip & Sandbox' : 'Script & Sandbox'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setRunningSandbox(true);
                      setInspectedPluginId(plg.id);
                      try {
                        const res = await fetch(`/api/plugins/${encodeURIComponent(plg.id)}/script`);
                        const data = (await res.json()) as { content?: string };
                        const code = data.content || plg.scriptPreview || '';
                        setPluginScriptDraft(code);
                        const result = await executePluginInSandbox(plg, code);
                        setSandboxOutput(result);
                        onPluginSandboxEffect?.(plg, result);
                        await fetch(`/api/plugins/${encodeURIComponent(plg.id)}/logs`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            summary: `${result.ok ? 'OK' : 'ERR'} (${result.durationMs}ms): ${result.logs.map((l) => l.message).join(' | ')}`,
                          }),
                        });
                      } finally {
                        setRunningSandbox(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white font-semibold hover:opacity-90"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Jalankan Sandbox' : 'Run Sandbox'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePlugin(plg.id)}
                    className={`px-3.5 py-2 rounded-lg font-semibold ${
                      plg.enabled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {plg.enabled
                      ? lang === 'id'
                        ? 'Aktif (Nonaktifkan)'
                        : 'Enabled (Disable)'
                      : lang === 'id'
                        ? 'Aktifkan'
                        : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePlugin(plg.id)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600"
                    title="Uninstall Plugin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inspectedPluginId && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'id' ? 'Editor & Penguji Sandbox Plugin:' : 'Plugin Script & Sandbox Runner:'}{' '}
                  <span className="font-mono text-[#0078D4] dark:text-sky-400">{inspectedPluginId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/plugins/${encodeURIComponent(inspectedPluginId)}/script`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: pluginScriptDraft }),
                      });
                      setPluginNotice(
                        lang === 'id' ? 'Skrip plugin tersimpan ke disk.' : 'Saved plugin script to disk.'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{lang === 'id' ? 'Simpan Skrip' : 'Save Script'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={runningSandbox}
                    onClick={async () => {
                      const plg = systemState.plugins.find((p) => p.id === inspectedPluginId);
                      if (!plg) return;
                      setRunningSandbox(true);
                      try {
                        const result = await executePluginInSandbox(plg, pluginScriptDraft);
                        setSandboxOutput(result);
                        onPluginSandboxEffect?.(plg, result);
                      } finally {
                        setRunningSandbox(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] text-white font-semibold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{runningSandbox ? 'Running...' : lang === 'id' ? 'Eksekusi Sekarang' : 'Execute in Sandbox'}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={8}
                value={pluginScriptDraft}
                onChange={(e) => setPluginScriptDraft(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs border border-slate-800"
              />

              {sandboxOutput && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>
                      Sandbox Status:{' '}
                      <strong className={sandboxOutput.ok ? 'text-emerald-400' : 'text-amber-400'}>
                        {sandboxOutput.ok ? 'PASSED' : 'BLOCKED / ERROR'}
                      </strong>
                    </span>
                    <span className="tabular-nums">{sandboxOutput.durationMs} ms</span>
                  </div>
                  {sandboxOutput.logs.map((entry, idx) => (
                    <div
                      key={idx}
                      className={
                        entry.level === 'denied'
                          ? 'text-amber-400'
                          : entry.level === 'error'
                            ? 'text-rose-400'
                            : 'text-emerald-300'
                      }
                    >
                      [{entry.level.toUpperCase()}] {entry.message}
                    </div>
                  ))}
                  {sandboxOutput.error && (
                    <div className="text-rose-400">[ERROR] {sandboxOutput.error}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. CONFIGURATION MANAGER */}
      {tab === 'config' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0078D4]" />
              <span>
                {lang === 'id'
                  ? 'Konfigurasi Global Runtime & Box64 Dynarec'
                  : 'Global Runtime & Box64 Dynarec Configuration'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateGlobalConfig(cfgDraft);
                setCfgSaved(true);
                window.setTimeout(() => setCfgSaved(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0078D4] text-white font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{cfgSaved ? 'Saved' : lang === 'id' ? 'Simpan Global' : 'Save Global'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Windows Version
              </label>
              <select
                value={cfgDraft.defaultWinVer}
                onChange={(e) =>
                  setCfgDraft({
                    ...cfgDraft,
                    defaultWinVer: e.target.value as GlobalRuntimeConfig['defaultWinVer'],
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="win10">Windows 10 (Recommended)</option>
                <option value="win11">Windows 11</option>
                <option value="win7">Windows 7</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                BOX64_DYNAREC_BIGBLOCK (0–3)
              </label>
              <input
                type="number"
                min={0}
                max={3}
                value={cfgDraft.box64BigBlock}
                onChange={(e) =>
                  setCfgDraft({ ...cfgDraft, box64BigBlock: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                BOX64_DYNAREC_STRONGMEM (0–3)
              </label>
              <input
                type="number"
                min={0}
                max={3}
                value={cfgDraft.box64StrongMem}
                onChange={(e) =>
                  setCfgDraft({ ...cfgDraft, box64StrongMem: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                DXVK_HUD Preset
              </label>
              <input
                type="text"
                value={cfgDraft.dxvkHud}
                onChange={(e) => setCfgDraft({ ...cfgDraft, dxvkHud: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WINEDEBUG Channel
              </label>
              <input
                type="text"
                value={cfgDraft.wineDebug}
                onChange={(e) => setCfgDraft({ ...cfgDraft, wineDebug: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgDraft.esyncEnabled}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, esyncEnabled: e.target.checked })}
                  className="accent-[#0078D4]"
                />
                <span>WINEESYNC=1</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgDraft.box64FastNan}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, box64FastNan: e.target.checked })}
                  className="accent-[#0078D4]"
                />
                <span>BOX64_DYNAREC_FASTNAN=1</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 9. LOGS & DIAGNOSTICS */}
      {tab === 'logs' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogFilter(lvl)}
                  className={`px-2.5 py-1 rounded-md font-mono font-medium ${
                    logFilter === lvl
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  {lvl === 'ALL' ? t.logs.filterAll : lvl}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onInjectSampleLog}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.logs.injectSample}
              </button>
              <a
                href="/api/diagnostics/export"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.logs.exportJson}</span>
              </a>
              <button
                type="button"
                onClick={onClearLogs}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600"
              >
                {t.logs.clearLogs}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {lang === 'id' ? 'Belum ada entri log.' : 'No diagnostic log entries.'}
              </div>
            ) : (
              filteredLogs.map((entry: DiagnosticLogEntry) => (
                <div key={entry.id} className="p-3.5 text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                    <span className="text-slate-400">{entry.timestamp}</span>
                    <span
                      className={`font-semibold ${
                        entry.level === 'ERROR'
                          ? 'text-red-600 dark:text-red-400'
                          : entry.level === 'WARN'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      [{entry.level}]
                    </span>
                    <span className="text-[#0078D4] dark:text-sky-400">{entry.module}</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-100">
                    {lang === 'id' ? entry.messageId : entry.messageEn}
                  </div>
                  {(entry.hintId || entry.hintEn) && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      {lang === 'id' ? entry.hintId : entry.hintEn}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
