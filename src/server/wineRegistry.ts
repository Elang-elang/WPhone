import type {
  DeviceHardwareProfile,
  DllOverrideMode,
  GlobalRuntimeConfig,
  PreflightCheckItem,
  PreflightReport,
  WindowsAppEntry,
  WinePrefixRecord,
  WineRegistryState,
} from '../types/wphone.ts';

const MODE_TO_WINE_CODE: Record<DllOverrideMode, string> = {
  'native,builtin': 'n,b',
  'builtin,native': 'b,n',
  native: 'n',
  builtin: 'b',
  disabled: '',
};

export function normalizeDllOverrideMode(raw: string): DllOverrideMode {
  const clean = raw.trim().toLowerCase();
  if (clean === 'native,builtin' || clean === 'n,b') return 'native,builtin';
  if (clean === 'builtin,native' || clean === 'b,n') return 'builtin,native';
  if (clean === 'native' || clean === 'n') return 'native';
  if (clean === 'builtin' || clean === 'b') return 'builtin';
  return 'disabled';
}

export function buildWineDllOverridesEnv(overrides: Record<string, DllOverrideMode>): string {
  return Object.entries(overrides)
    .filter(([k]) => k.trim().length > 0)
    .map(([dll, mode]) => `${dll}=${MODE_TO_WINE_CODE[mode]}`)
    .join(';');
}

export function serializeUserReg(
  appName: string,
  hive: Omit<WineRegistryState, 'wineDllOverridesEnv' | 'rawUserReg'>
): string {
  const lines: string[] = [
    'WINE REGISTRY Version 2',
    `;; Isolated prefix hive for ${appName} (${hive.prefixId})`,
    '',
    '[Software\\\\Wine]',
    `"Version"="${hive.winVersion}"`,
    '',
    '[Software\\\\Wine\\\\Drivers]',
    `"Audio"="${hive.audioDriver}"`,
    '',
    '[Software\\\\Wine\\\\Direct3D]',
    `"DirectDrawRenderer"="${hive.directDrawRenderer}"`,
    `"OffscreenRenderingMode"="${hive.offscreenRenderingMode}"`,
    `"VideoMemorySize"="${hive.videoMemorySize}"`,
    `"csmt"=dword:${hive.csmtEnabled ? '00000001' : '00000000'}`,
    '',
    '[Software\\\\Wine\\\\DllOverrides]',
  ];

  for (const [dll, mode] of Object.entries(hive.dllOverrides)) {
    const val = mode === 'disabled' ? '' : mode;
    lines.push(`"${dll}"="${val}"`);
  }
  lines.push('');
  return lines.join('\n');
}

export function parseUserReg(prefixId: string, raw: string): WineRegistryState {
  let winVersion: 'win10' | 'win11' | 'win7' = 'win10';
  let audioDriver: 'pulse' | 'alsa' | 'null' = 'pulse';
  let directDrawRenderer: 'opengl' | 'gdi' | 'vulkan' = 'opengl';
  let offscreenRenderingMode: 'fbo' | 'backbuffer' = 'fbo';
  let videoMemorySize = 512;
  let csmtEnabled = true;
  const dllOverrides: Record<string, DllOverrideMode> = {};

  let section = '';
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('WINE REGISTRY')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).toLowerCase();
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim().replace(/^"|"$/g, '');
    const val = line.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');

    if (section === 'software\\\\wine' && key.toLowerCase() === 'version') {
      if (val === 'win7' || val === 'win10' || val === 'win11') winVersion = val;
    } else if (section === 'software\\\\wine\\\\drivers' && key.toLowerCase() === 'audio') {
      if (val === 'pulse' || val === 'alsa' || val === 'null') audioDriver = val;
    } else if (section === 'software\\\\wine\\\\direct3d') {
      const k = key.toLowerCase();
      if (k === 'directdrawrenderer' && (val === 'opengl' || val === 'gdi' || val === 'vulkan')) {
        directDrawRenderer = val;
      } else if (k === 'offscreenrenderingmode' && (val === 'fbo' || val === 'backbuffer')) {
        offscreenRenderingMode = val;
      } else if (k === 'videomemorysize') {
        const parsed = Number.parseInt(val, 10);
        if (Number.isFinite(parsed) && parsed > 0) videoMemorySize = parsed;
      } else if (k === 'csmt') {
        csmtEnabled = !val.endsWith('00000000');
      }
    } else if (section === 'software\\\\wine\\\\dlloverrides') {
      dllOverrides[key] = normalizeDllOverrideMode(val);
    }
  }

  return {
    prefixId,
    winVersion,
    audioDriver,
    directDrawRenderer,
    offscreenRenderingMode,
    videoMemorySize,
    csmtEnabled,
    dllOverrides,
    wineDllOverridesEnv: buildWineDllOverridesEnv(dllOverrides),
    rawUserReg: raw,
  };
}

export const DEPENDENCY_DLL_MAP: Record<
  string,
  { dllFiles: string[]; overrides: Record<string, DllOverrideMode> }
> = {
  vcrun2022: {
    dllFiles: ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'ucrtbase.dll'],
    overrides: {
      vcruntime140: 'native,builtin',
      vcruntime140_1: 'native,builtin',
      msvcp140: 'native,builtin',
      ucrtbase: 'native,builtin',
    },
  },
  vcrun2019: {
    dllFiles: ['msvcr120.dll', 'msvcp120.dll', 'vcruntime140.dll'],
    overrides: {
      msvcr120: 'native,builtin',
      msvcp120: 'native,builtin',
    },
  },
  d3dcompiler_47: {
    dllFiles: ['d3dcompiler_47.dll'],
    overrides: {
      d3dcompiler_47: 'native,builtin',
    },
  },
  corefonts: {
    dllFiles: ['LiberationSans-Regular.ttf', 'LiberationMono-Regular.ttf'],
    overrides: {},
  },
  dotnet48: {
    dllFiles: ['mscoree.dll', 'wine-mono-9.3.0.msi'],
    overrides: {
      mscoree: 'builtin,native',
    },
  },
};

export function evaluateAppPreflight(params: {
  app: WindowsAppEntry;
  prefix: WinePrefixRecord | undefined;
  registry: WineRegistryState;
  device: DeviceHardwareProfile | undefined;
  globalConfig: GlobalRuntimeConfig;
}): PreflightReport {
  const { app, prefix, registry, device, globalConfig } = params;
  const checks: PreflightCheckItem[] = [];
  const installedDeps = prefix?.installedDeps || [];

  const requiredDeps = new Set<string>(app.dependencies);
  for (const dll of app.importedDlls || []) {
    const low = dll.toLowerCase();
    if (low.includes('vcruntime140') || low.includes('msvcp140')) requiredDeps.add('vcrun2022');
    if (low.includes('msvcr120') || low.includes('msvcp120')) requiredDeps.add('vcrun2019');
    if (low.includes('d3dcompiler_47') || low.includes('d3d11')) requiredDeps.add('d3dcompiler_47');
    if (low.includes('mscoree')) requiredDeps.add('dotnet48');
  }
  const missingDependencies = Array.from(requiredDeps).filter((d) => !installedDeps.includes(d));

  checks.push({
    id: 'arch',
    label: 'PE Architecture & WoW64 Routing',
    status: 'pass',
    detail: `${app.arch.toUpperCase()} PE executable routed via Wine WoW64 + Box64.`,
  });

  if (missingDependencies.length === 0) {
    checks.push({
      id: 'deps',
      label: 'Prefix Runtime Libraries & DLLs',
      status: 'pass',
      detail:
        requiredDeps.size > 0
          ? `All required libraries installed (${Array.from(requiredDeps).join(', ')}).`
          : 'No extra redistributables required beyond Wine builtin DLLs.',
    });
  } else {
    checks.push({
      id: 'deps',
      label: 'Prefix Runtime Libraries & DLLs',
      status: 'warn',
      detail: `Missing prefix packages: ${missingDependencies.join(', ')}. Install in Prefix & Dependencies before launch.`,
    });
  }

  const isLegacy = Boolean(device?.isSubAndroid10 || device?.lowRamMode);
  if (device && !device.turnipSupported && app.graphicsBackend === 'turnip-dxvk') {
    checks.push({
      id: 'gfx',
      label: 'Graphics Pipeline Compatibility',
      status: 'warn',
      detail: `${device.gpuName} does not support Mesa Turnip. Switch to System Vulkan or VirGL/GLES.`,
    });
  } else if (isLegacy && app.graphicsBackend !== 'wined3d-virgl') {
    checks.push({
      id: 'gfx',
      label: 'Sub-Android 10 Graphics Lightweight Check',
      status: 'warn',
      detail: `${device?.name}: ${app.graphicsBackend} increases RAM/shader pressure on Android ${device?.androidVersion}. VirGL/GLES recommended.`,
    });
  } else {
    checks.push({
      id: 'gfx',
      label: 'Graphics Pipeline Compatibility',
      status: 'pass',
      detail: `Renderer ${app.graphicsBackend} (user.reg DirectDrawRenderer=${registry.directDrawRenderer}, VRAM=${registry.videoMemorySize} MB).`,
    });
  }

  if (device && device.androidApiLevel < 27 && app.audioDriver === 'pulse-aaudio') {
    checks.push({
      id: 'audio',
      label: 'Android Audio Bridge',
      status: 'warn',
      detail: `Android API ${device.androidApiLevel} (< 8.1) lacks native AAudio. Switch to OpenSL ES fallback.`,
    });
  } else {
    checks.push({
      id: 'audio',
      label: 'Android Audio Bridge',
      status: 'pass',
      detail: `PulseAudio -> ${app.audioDriver === 'pulse-opensl' ? 'OpenSL ES (API 24+ compatible)' : app.audioDriver}.`,
    });
  }

  const baseRam = app.category === 'Games' ? 680 : app.id.includes('vscode') ? 540 : 210;
  const backendOverhead =
    app.graphicsBackend === 'vkd3d-proton'
      ? 420
      : app.graphicsBackend === 'wined3d-virgl'
        ? 95
        : 220;
  const estimatedRamMb = baseRam + backendOverhead;
  const hostBudgetMb = (device?.ramGb || 8) * 1024 * (isLegacy ? 0.45 : 0.65);

  checks.push({
    id: 'memory',
    label: 'Memory & Container Budget',
    status: estimatedRamMb > hostBudgetMb ? 'fail' : estimatedRamMb > hostBudgetMb * 0.8 ? 'warn' : 'pass',
    detail: `Estimated ${estimatedRamMb} MB against ~${Math.round(hostBudgetMb)} MB safe container budget (${device?.ramGb || 8} GB device RAM).`,
  });

  const resolvedEnv: Record<string, string> = {
    WINEPREFIX: prefix?.path || `/WPhone/prefixes/${app.prefixId}`,
    WINEESYNC: globalConfig.esyncEnabled && !isLegacy ? '1' : '0',
    WINEDEBUG: globalConfig.wineDebug,
    BOX64_DYNAREC_BIGBLOCK: String(isLegacy ? 1 : globalConfig.box64BigBlock),
    BOX64_DYNAREC_STRONGMEM: String(isLegacy ? 0 : globalConfig.box64StrongMem),
    ...(isLegacy ? { BOX64_MMAP32: '1' } : {}),
    PULSE_LATENCY_MSEC: app.audioDriver === 'pulse-opensl' ? '60' : '30',
    ...(registry.wineDllOverridesEnv ? { WINEDLLOVERRIDES: registry.wineDllOverridesEnv } : {}),
    ...app.envVars,
  };

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');

  return {
    appId: app.id,
    appName: app.name,
    overallStatus: hasFail ? 'blocked' : hasWarn ? 'degraded' : 'ready',
    estimatedRamMb,
    commandLine: `box64 wine64 "${app.executablePath}" ${app.arguments}`.trim(),
    resolvedEnv,
    missingDependencies,
    checks,
  };
}
