export type LanguagePreference = 'auto' | 'id' | 'en';
export type ResolvedLanguage = 'id' | 'en';
export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type WorkspaceSection = 'prototype' | 'docs' | 'compatibility' | 'android';
export type DeviceViewportMode = 'mobile' | 'expanded';

export type SetupMode = 'easy' | 'advanced';
export type EasyProfile = 'light' | 'medium' | 'advanced';

export type AppCategory = 'Productivity' | 'Utilities' | 'DevTools' | 'Games';
export type WinArch = 'x64' | 'x86';
export type GraphicsBackend = 'turnip-dxvk' | 'system-vulkan-dxvk' | 'vkd3d-proton' | 'wined3d-virgl';
export type AudioDriver = 'pulse-aaudio' | 'pulse-opensl' | 'alsa-null';
export type KeyboardMode = 'desktop' | 'gaming';

export type VerificationStatus =
  | 'verified'
  | 'likely'
  | 'unverified'
  | 'needs_testing'
  | 'not_feasible';

export interface DeviceHardwareProfile {
  id: string;
  name: string;
  soc: string;
  cpuArch: string;
  cores: number;
  ramGb: number;
  freeStorageGb: number;
  gpuName: string;
  gpuVendor: 'adreno' | 'mali' | 'other';
  vulkanVersion: string;
  turnipSupported: boolean;
  androidVersion: number;
  recommendedEasyProfile: EasyProfile;
  recommendedGraphics: GraphicsBackend;
  notesId: string;
  notesEn: string;
}

export interface RuntimeComponent {
  id: string;
  name: string;
  category: 'wine' | 'translator' | 'graphics' | 'audio' | 'container';
  version: string;
  license: string;
  sizeMb: number;
  installed: boolean;
  essential: boolean;
  archSupport: string;
  verification: VerificationStatus;
  descriptionId: string;
  descriptionEn: string;
}

export interface AdvancedSetupConfig {
  targetAppArch: 'x86+x64-wow64' | 'x64-only' | 'x86-only';
  runtimeEngine: 'wine-wow64-box64' | 'wine-arm64ec-fex-experimental';
  graphicsBackend: GraphicsBackend;
  audioDriver: AudioDriver;
  storageLocation: 'internal-app-data' | 'scoped-external';
  optionalDependencies: string[];
}

export interface GlobalRuntimeConfig {
  defaultWinVer: 'win10' | 'win11' | 'win7';
  defaultResolution: string;
  defaultDpi: number;
  box64BigBlock: number;
  box64StrongMem: number;
  box64FastNan: boolean;
  dxvkHud: string;
  esyncEnabled: boolean;
  wineDebug: string;
}

export interface WindowsAppEntry {
  id: string;
  name: string;
  category: AppCategory;
  iconKey: string;
  executablePath: string;
  arguments: string;
  workingDirectory: string;
  arch: WinArch;
  prefixId: string;
  graphicsBackend: GraphicsBackend;
  audioDriver: AudioDriver;
  resolution: string;
  dpi: number;
  envVars: Record<string, string>;
  keyboardMode: KeyboardMode;
  keyboardPreset: string;
  dependencies: string[];
  lastRunAt: string | null;
  sourceMethod: 'installer' | 'import' | 'shortcut' | 'builtin';
  sha256?: string;
  importedDlls?: string[];
}

export interface WinePrefixRecord {
  id: string;
  appId: string;
  path: string;
  winVersion: 'win10' | 'win11' | 'win7';
  sizeMb: number;
  installedDeps: string[];
  createdAt: string;
}

export interface VirtualFsNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  sizeKb: number;
  protected: boolean;
  modifiedAt: string;
  previewContent?: string;
}

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  module:
    | 'SetupWizard'
    | 'WineWoW64'
    | 'Box64'
    | 'DXVK'
    | 'PrefixMgr'
    | 'AudioBridge'
    | 'FileMgr'
    | 'PluginHost'
    | 'PEInspector';
  level: 'INFO' | 'WARN' | 'ERROR';
  messageId: string;
  messageEn: string;
  hintId?: string;
  hintEn?: string;
}

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  category: 'frontend' | 'backend';
  author: string;
  description: string;
  scriptLanguage: 'javascript' | 'python' | 'java';
  mainScript: string;
  apiVersion: string;
  permissions: string[];
  dependencies: string[];
  enabled: boolean;
  sha256: string;
  installedAt: string;
  readme?: string;
  accentColor?: string;
}

export interface ManagedProcess {
  pid: number;
  appId: string;
  appName: string;
  prefixId: string;
  arch: WinArch;
  graphicsBackend: GraphicsBackend;
  status: 'running' | 'stopping';
  cpuPercent: number;
  ramMb: number;
  startedAt: string;
  commandLine: string;
}

export interface GamingPadControl {
  id: string;
  label: string;
  mappedKey: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  visible: boolean;
}

export interface KeyboardPresetConfig {
  id: string;
  name: string;
  mode: KeyboardMode;
  opacity: number;
  desktopKeys: string[];
  stickyModifiers: boolean;
  gamingControls: GamingPadControl[];
}

export interface DependencyCatalogItem {
  id: string;
  name: string;
  sizeMb: number;
  license: string;
  descriptionId: string;
  descriptionEn: string;
  triggeredByDlls: string[];
}

export interface CompatibilityMatrixItem {
  id: string;
  component: string;
  roleId: string;
  roleEn: string;
  license: string;
  repository: string;
  maintenance: 'Active' | 'Experimental' | 'Community';
  hostArch: string;
  verification: VerificationStatus;
  constraintsId: string;
  constraintsEn: string;
}

export interface EngineeringDoc {
  id: string;
  filename: string;
  titleId: string;
  titleEn: string;
  phase: string;
  summaryId: string;
  summaryEn: string;
  contentId: string;
  contentEn: string;
}

export interface PeInspectionClientResult {
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  validPe: boolean;
  formatLabel: string;
  arch: 'x86' | 'x64' | 'arm64' | 'unknown';
  machineHex: string;
  isDll: boolean;
  subsystem: string;
  sections: string[];
  importedDlls: string[];
  suggestedDependencies: string[];
  recommendedGraphics: GraphicsBackend;
  notes: string;
}

export interface WPhoneSystemState {
  initialized: boolean;
  deviceProfileId: string;
  setupMode: SetupMode;
  easyProfile: EasyProfile;
  advancedConfig: AdvancedSetupConfig;
  globalConfig: GlobalRuntimeConfig;
  components: RuntimeComponent[];
  apps: WindowsAppEntry[];
  prefixes: WinePrefixRecord[];
  plugins: InstalledPlugin[];
  keyboardPresets: KeyboardPresetConfig[];
  processes: ManagedProcess[];
  fsNodes: VirtualFsNode[];
  logs: DiagnosticLogEntry[];
}
