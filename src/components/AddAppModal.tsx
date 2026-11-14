import React, { useRef, useState } from 'react';
import {
  FolderSearch,
  PackagePlus,
  Link2,
  Sliders,
  X,
  AlertCircle,
  Upload,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import {
  AppCategory,
  AudioDriver,
  GraphicsBackend,
  KeyboardMode,
  PeInspectionClientResult,
  ResolvedLanguage,
  WinArch,
  WindowsAppEntry,
} from '../types/wphone';
import { translations } from '../i18n/translations';

interface AddAppModalProps {
  open: boolean;
  editingApp: WindowsAppEntry | null;
  lang: ResolvedLanguage;
  onClose: () => void;
  onSaveApp: (app: WindowsAppEntry, isNew: boolean) => void;
}

type ModalMode = 'installer' | 'import' | 'shortcut' | 'config';

const SAMPLE_IMPORT_FOLDERS = [
  {
    folderName: 'D:\\Imports\\KritaPortable',
    exes: [
      { name: 'krita.exe', arch: 'x64' as WinArch },
      { name: 'crashpad_handler.exe', arch: 'x64' as WinArch },
    ],
    suggestedDeps: ['vcrun2022', 'corefonts'],
    category: 'Productivity' as AppCategory,
  },
  {
    folderName: 'D:\\Games\\Celeste_Win',
    exes: [
      { name: 'Celeste.exe', arch: 'x86' as WinArch },
      { name: 'FNA_Check.exe', arch: 'x86' as WinArch },
    ],
    suggestedDeps: ['dotnet48', 'd3dcompiler_47'],
    category: 'Games' as AppCategory,
  },
];

export const AddAppModal: React.FC<AddAppModalProps> = ({
  open,
  editingApp,
  lang,
  onClose,
  onSaveApp,
}) => {
  const t = translations[lang].library.addModal;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<ModalMode>(editingApp ? 'config' : 'installer');
  const [name, setName] = useState(editingApp?.name || '');
  const [category, setCategory] = useState<AppCategory>(editingApp?.category || 'Productivity');
  const [iconKey, setIconKey] = useState(editingApp?.iconKey || 'app');
  const [execPath, setExecPath] = useState(
    editingApp?.executablePath || 'C:\\Program Files\\MyApp\\app.exe'
  );
  const [args, setArgs] = useState(editingApp?.arguments || '');
  const [workingDir, setWorkingDir] = useState(
    editingApp?.workingDirectory || 'C:\\Program Files\\MyApp'
  );
  const [arch, setArch] = useState<WinArch>(editingApp?.arch || 'x64');
  const [prefixId, setPrefixId] = useState(
    editingApp?.prefixId || `pfx-${Date.now().toString(36).slice(-5)}`
  );
  const [graphicsBackend, setGraphicsBackend] = useState<GraphicsBackend>(
    editingApp?.graphicsBackend || 'system-vulkan-dxvk'
  );
  const [audioDriver, setAudioDriver] = useState<AudioDriver>(
    editingApp?.audioDriver || 'pulse-aaudio'
  );
  const [resolution, setResolution] = useState(editingApp?.resolution || '1280x720');
  const [dpi, setDpi] = useState(editingApp?.dpi || 120);
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>(
    editingApp?.keyboardMode || 'desktop'
  );
  const [envText, setEnvText] = useState(
    editingApp
      ? Object.entries(editingApp.envVars)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      : 'WINEDEBUG=-all\nBOX64_DYNAREC_STRONGMEM=1'
  );

  // Real PE Binary Inspection state
  const [inspecting, setInspecting] = useState(false);
  const [peResult, setPeResult] = useState<PeInspectionClientResult | null>(null);
  const [peError, setPeError] = useState<string | null>(null);
  const [scannedFolderIdx, setScannedFolderIdx] = useState<number | null>(null);

  if (!open) return null;

  const handleUploadBinary = async (file: File) => {
    setInspecting(true);
    setPeError(null);
    try {
      const form = new FormData();
      form.append('binary', file);
      const res = await fetch('/api/pe/inspect', { method: 'POST', body: form });
      const data = (await res.json()) as PeInspectionClientResult & {
        error?: string;
        savedVirtualPath?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect binary');
      }
      setPeResult(data);
      const cleanName = file.name.replace(/\.(exe|msi|dll)$/i, '');
      setName(cleanName);
      setExecPath(
        data.savedVirtualPath
          ? `Z:${data.savedVirtualPath.replace(/\//g, '\\')}`
          : `C:\\Program Files\\${cleanName}\\${file.name}`
      );
      setWorkingDir(`C:\\Program Files\\${cleanName}`);
      if (data.arch === 'x86' || data.arch === 'x64') {
        setArch(data.arch);
      }
      if (data.recommendedGraphics) {
        setGraphicsBackend(data.recommendedGraphics);
      }
    } catch (err) {
      setPeError(err instanceof Error ? err.message : 'Inspection error');
    } finally {
      setInspecting(false);
    }
  };

  const handleScanSample = (idx: number) => {
    setScannedFolderIdx(idx);
    const folder = SAMPLE_IMPORT_FOLDERS[idx];
    const mainExe = folder.exes[0];
    setName(mainExe.name.replace('.exe', ''));
    setCategory(folder.category);
    setExecPath(`${folder.folderName}\\${mainExe.name}`);
    setWorkingDir(folder.folderName);
    setArch(mainExe.arch);
    setKeyboardMode(folder.category === 'Games' ? 'gaming' : 'desktop');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEnv: Record<string, string> = {};
    envText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const eq = line.indexOf('=');
        if (eq > 0) {
          parsedEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      });

    const finalName = name.trim() || execPath.split('\\').pop() || 'Windows App';
    const entry: WindowsAppEntry = {
      id: editingApp ? editingApp.id : `app-${Date.now().toString(36)}`,
      name: finalName,
      category,
      iconKey,
      executablePath: execPath.trim(),
      arguments: args.trim(),
      workingDirectory: workingDir.trim(),
      arch,
      prefixId: prefixId.trim() || `pfx-${finalName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      graphicsBackend,
      audioDriver,
      resolution,
      dpi: Number(dpi) || 96,
      envVars: parsedEnv,
      keyboardMode,
      keyboardPreset:
        keyboardMode === 'gaming' ? 'Metroidvania 8-Button Pad' : 'IDE & Terminal (Ctrl/Alt/F1-12)',
      dependencies:
        peResult?.suggestedDependencies && peResult.suggestedDependencies.length > 0
          ? peResult.suggestedDependencies
          : scannedFolderIdx !== null
            ? SAMPLE_IMPORT_FOLDERS[scannedFolderIdx].suggestedDeps
            : editingApp?.dependencies || ['vcrun2022'],
      lastRunAt: editingApp?.lastRunAt || null,
      sourceMethod: editingApp
        ? editingApp.sourceMethod
        : tab === 'installer'
          ? 'installer'
          : tab === 'import'
            ? 'import'
            : 'shortcut',
      sha256: peResult?.sha256 || editingApp?.sha256,
      importedDlls: peResult?.importedDlls || editingApp?.importedDlls,
    };

    onSaveApp(entry, !editingApp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
            {t.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Method Tabs */}
        {!editingApp && (
          <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
            {[
              { id: 'installer' as const, label: t.tabInstaller, Icon: PackagePlus },
              { id: 'import' as const, label: t.tabImport, Icon: FolderSearch },
              { id: 'shortcut' as const, label: t.tabShortcut, Icon: Link2 },
              { id: 'config' as const, label: t.tabConfig, Icon: Sliders },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors ${
                  tab === id
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Real Binary Upload & PE Header Parser */}
          {tab === 'installer' && !editingApp && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.installerHelp}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".exe,.msi,.dll"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadBinary(file);
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={inspecting}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#0078D4]/50 bg-white dark:bg-slate-900 text-[#0078D4] dark:text-sky-400 font-semibold hover:bg-[#0078D4]/5 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {inspecting
                    ? lang === 'id'
                      ? 'Menganalisis Header PE32/PE32+...'
                      : 'Parsing PE32/PE32+ Header...'
                    : lang === 'id'
                      ? 'Unggah & Inspeksi Berkas .exe / .msi / .dll Asli'
                      : 'Upload & Inspect Real .exe / .msi / .dll Binary'}
                </span>
              </button>

              {peError && (
                <div className="text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{peError}</span>
                </div>
              )}

              {peResult && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {peResult.validPe ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Cpu className="w-4 h-4 text-amber-600" />
                      )}
                      <span>{peResult.formatLabel}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {(peResult.fileSizeBytes / 1024).toFixed(1)} KB · {peResult.machineHex}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 break-all">
                    SHA-256: {peResult.sha256}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Subsystem: <span className="font-mono">{peResult.subsystem}</span> · Sections:{' '}
                    <span className="font-mono">{peResult.sections.join(', ') || 'None'}</span>
                  </div>
                  {peResult.importedDlls.length > 0 && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Imported DLLs:{' '}
                      <span className="font-mono text-[#0078D4] dark:text-sky-400">
                        {peResult.importedDlls.slice(0, 10).join(', ')}
                        {peResult.importedDlls.length > 10
                          ? ` (+${peResult.importedDlls.length - 10})`
                          : ''}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {peResult.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'import' && !editingApp && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-2.5">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t.importHelp}</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_IMPORT_FOLDERS.map((folder, idx) => (
                  <button
                    key={folder.folderName}
                    type="button"
                    onClick={() => handleScanSample(idx)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      scannedFolderIdx === idx
                        ? 'border-[#0078D4] bg-[#0078D4] text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {t.scanFolder}: {folder.folderName.split('\\').pop()}
                  </button>
                ))}
              </div>
              {scannedFolderIdx !== null && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    {t.detectedExes}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_IMPORT_FOLDERS[scannedFolderIdx].exes.map((exe) => (
                      <button
                        key={exe.name}
                        type="button"
                        onClick={() => {
                          setExecPath(
                            `${SAMPLE_IMPORT_FOLDERS[scannedFolderIdx].folderName}\\${exe.name}`
                          );
                          setArch(exe.arch);
                        }}
                        className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 font-mono text-[11px] bg-white dark:bg-slate-900"
                      >
                        {exe.name} ({exe.arch})
                      </button>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{t.detectedDepsNote}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'shortcut' && !editingApp && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-600 dark:text-slate-300">
              {t.shortcutHelp}
            </div>
          )}

          {/* Core Application & Per-App Configuration Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.appName}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SumatraPDF 3.5"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.category}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AppCategory)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Productivity">Productivity</option>
                <option value="Utilities">Utilities</option>
                <option value="DevTools">DevTools</option>
                <option value="Games">Games</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.execPath}
              </label>
              <input
                type="text"
                required
                value={execPath}
                onChange={(e) => setExecPath(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.launchArgs}
              </label>
              <input
                type="text"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="-nosession / --no-sandbox"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.workingDir}
              </label>
              <input
                type="text"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.prefixId}
              </label>
              <input
                type="text"
                value={prefixId}
                onChange={(e) => setPrefixId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.winArch}
              </label>
              <select
                value={arch}
                onChange={(e) => setArch(e.target.value as WinArch)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="x64">x64 (64-bit PE via Box64 + Wine WoW64)</option>
                <option value="x86">x86 (32-bit PE via Wine WoW64 Thunk)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.graphics}
              </label>
              <select
                value={graphicsBackend}
                onChange={(e) => setGraphicsBackend(e.target.value as GraphicsBackend)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="turnip-dxvk">Mesa Turnip + DXVK</option>
                <option value="system-vulkan-dxvk">System Vulkan + DXVK</option>
                <option value="vkd3d-proton">VKD3D-Proton (DX12)</option>
                <option value="wined3d-virgl">WineD3D / VirGL</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.audio}
              </label>
              <select
                value={audioDriver}
                onChange={(e) => setAudioDriver(e.target.value as AudioDriver)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="pulse-aaudio">PulseAudio → Android AAudio</option>
                <option value="pulse-opensl">PulseAudio → OpenSL ES</option>
                <option value="alsa-null">Disabled / Null</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.resolution} · DPI
              </label>
              <div className="flex gap-2">
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="1280x720">1280x720</option>
                  <option value="1440x900">1440x900</option>
                  <option value="1600x900">1600x900</option>
                  <option value="1920x1080">1920x1080</option>
                </select>
                <input
                  type="number"
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  min={72}
                  max={240}
                  className="w-20 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.keyboardMode}
              </label>
              <select
                value={keyboardMode}
                onChange={(e) => setKeyboardMode(e.target.value as KeyboardMode)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="desktop">Desktop / Application Keyboard</option>
                <option value="gaming">Gaming Touch Keyboard</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Icon Type
              </label>
              <select
                value={iconKey}
                onChange={(e) => setIconKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="app">Windows Default</option>
                <option value="editor">Text / Code Editor</option>
                <option value="sheet">Productivity / Office</option>
                <option value="archive">System Utility</option>
                <option value="gamepad">Game</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.envVars}
              </label>
              <textarea
                rows={3}
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white font-semibold"
            >
              {editingApp ? t.updateApp : t.saveApp}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
