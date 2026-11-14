import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  AdvancedSetupConfig,
  EasyProfile,
  GraphicsBackend,
  ResolvedLanguage,
  RuntimeComponent,
  SetupMode,
  WPhoneSystemState,
} from '../types/wphone';
import { translations } from '../i18n/translations';
import { DEVICE_PROFILES } from '../data/mockData';
import { WPhoneIcon } from './WPhoneIcon';

interface SetupWizardProps {
  systemState: WPhoneSystemState;
  lang: ResolvedLanguage;
  onComplete: (updates: {
    deviceProfileId: string;
    setupMode: SetupMode;
    easyProfile: EasyProfile;
    advancedConfig: AdvancedSetupConfig;
    installedComponentIds: string[];
    logMessageId: string;
    logMessageEn: string;
  }) => void;
  onCancelToLibrary?: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  systemState,
  lang,
  onComplete,
  onCancelToLibrary,
}) => {
  const t = translations[lang].wizard;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [deviceId, setDeviceId] = useState<string>(systemState.deviceProfileId);
  const [mode, setMode] = useState<SetupMode>(systemState.setupMode);
  const [easyProfile, setEasyProfile] = useState<EasyProfile>(systemState.easyProfile);
  const [adv, setAdv] = useState<AdvancedSetupConfig>({ ...systemState.advancedConfig });

  // Step 3 installation simulation state
  const [installPhase, setInstallPhase] = useState<
    'idle' | 'downloading' | 'interrupted' | 'verifying' | 'done'
  >('idle');
  const [progress, setProgress] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const device = useMemo(
    () => DEVICE_PROFILES.find((d) => d.id === deviceId) || DEVICE_PROFILES[0],
    [deviceId]
  );

  // Sync recommended defaults when switching hardware profile
  const handleSelectDevice = (newId: string) => {
    setDeviceId(newId);
    const prof = DEVICE_PROFILES.find((d) => d.id === newId);
    if (prof) {
      setEasyProfile(prof.recommendedEasyProfile);
      setAdv((prev) => ({
        ...prev,
        graphicsBackend: prof.recommendedGraphics,
        optionalDependencies:
          prof.recommendedEasyProfile === 'light'
            ? []
            : prof.recommendedEasyProfile === 'medium'
              ? ['dxvk']
              : prof.turnipSupported
                ? ['dxvk', 'mesa-turnip', 'vkd3d-proton']
                : ['dxvk', 'vkd3d-proton'],
      }));
    }
  };

  // Compute selected components based on Easy vs Advanced
  const selectedComponents = useMemo<RuntimeComponent[]>(() => {
    const essentials = systemState.components.filter((c) => c.essential);
    if (mode === 'easy') {
      if (easyProfile === 'light') return essentials;
      if (easyProfile === 'medium') {
        return systemState.components.filter((c) => c.essential || c.id === 'dxvk');
      }
      return systemState.components.filter((c) => {
        if (c.essential) return true;
        if (c.id === 'mesa-turnip') return device.turnipSupported;
        return c.id === 'dxvk' || c.id === 'vkd3d-proton';
      });
    }
    return systemState.components.filter(
      (c) => c.essential || adv.optionalDependencies.includes(c.id)
    );
  }, [mode, easyProfile, adv.optionalDependencies, systemState.components, device.turnipSupported]);

  const totalSizeMb = useMemo(
    () => selectedComponents.reduce((sum, c) => sum + c.sizeMb, 0),
    [selectedComponents]
  );

  // Compatibility warnings if user overrides recommendations
  const compatibilityRisks = useMemo(() => {
    const risks: string[] = [];
    if (mode === 'easy') {
      if (device.ramGb <= 4 && easyProfile === 'advanced') {
        risks.push(
          lang === 'id'
            ? 'RAM perangkat hanya 4 GB. Profil Advanced (DX12 / VKD3D) berisiko kehabisan memori (OOM).'
            : 'Device has 4 GB RAM. Advanced profile (DX12 / VKD3D) risks out-of-memory termination.'
        );
      }
    } else {
      if (adv.graphicsBackend === 'turnip-dxvk' && !device.turnipSupported) {
        risks.push(
          lang === 'id'
            ? `GPU ${device.gpuName} bukan Qualcomm Adreno. Driver Mesa Turnip tidak kompatibel dan dapat menyebabkan layar hitam.`
            : `${device.gpuName} is not a Qualcomm Adreno GPU. Mesa Turnip is incompatible and may cause black screens.`
        );
      }
      if (adv.runtimeEngine === 'wine-arm64ec-fex-experimental') {
        risks.push(
          lang === 'id'
            ? 'Wine ARM64EC + FEX-Emu berstatus Perlu Pengujian di Android non-root; Wine WoW64 + Box64 lebih teruji.'
            : 'Wine ARM64EC + FEX-Emu is marked Needs Testing on rootless Android; Wine WoW64 + Box64 is recommended.'
        );
      }
      if (adv.optionalDependencies.includes('vkd3d-proton') && device.ramGb <= 4) {
        risks.push(
          lang === 'id'
            ? 'VKD3D-Proton (DX12) tidak disarankan untuk perangkat 4 GB RAM.'
            : 'VKD3D-Proton (DX12) is not recommended on 4 GB RAM devices.'
        );
      }
      if (adv.targetAppArch === 'x86-only') {
        risks.push(
          lang === 'id'
            ? 'Membatasi ke x86-only menonaktifkan aplikasi produktivitas Windows 64-bit modern.'
            : 'Restricting to x86-only prevents launching modern 64-bit Windows apps.'
        );
      }
    }
    return risks;
  }, [mode, easyProfile, adv, device, lang]);

  // Simulated resumable download & verification loop
  useEffect(() => {
    if (installPhase !== 'downloading') return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(timer);
          setInstallPhase('verifying');
          return 100;
        }
        const next = Math.min(100, prev + 8);
        const idx = Math.min(
          selectedComponents.length - 1,
          Math.floor((next / 100) * selectedComponents.length)
        );
        setActiveIndex(idx);
        return next;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [installPhase, selectedComponents.length]);

  useEffect(() => {
    if (installPhase !== 'verifying') return;
    const timer = window.setTimeout(() => {
      setInstallPhase('done');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [installPhase]);

  const startInstall = () => {
    setProgress(0);
    setActiveIndex(0);
    setInstallPhase('downloading');
  };

  const toggleOptionalDep = (id: string) => {
    setAdv((prev) => {
      const exists = prev.optionalDependencies.includes(id);
      return {
        ...prev,
        optionalDependencies: exists
          ? prev.optionalDependencies.filter((d) => d !== id)
          : [...prev.optionalDependencies, id],
      };
    });
  };

  const handleFinish = () => {
    onComplete({
      deviceProfileId: deviceId,
      setupMode: mode,
      easyProfile,
      advancedConfig: adv,
      installedComponentIds: selectedComponents.map((c) => c.id),
      logMessageId: `Setup WPhone selesai (${mode === 'easy' ? `Easy/${easyProfile}` : 'Advanced'}) · ${selectedComponents.length} komponen (${totalSizeMb} MB) terverifikasi.`,
      logMessageEn: `WPhone setup completed (${mode === 'easy' ? `Easy/${easyProfile}` : 'Advanced'}) · ${selectedComponents.length} components (${totalSizeMb} MB) verified.`,
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <WPhoneIcon variant="internal" className="w-9 h-9" alt="WPhone Engine" />
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50">
              {t.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>
        {systemState.initialized && onCancelToLibrary && (
          <button
            type="button"
            onClick={onCancelToLibrary}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap"
          >
            {lang === 'id' ? 'Kembali ke Library' : 'Back to Library'}
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { num: 1 as const, label: t.step1 },
          { num: 2 as const, label: t.step2 },
          { num: 3 as const, label: t.step3 },
        ].map((item) => (
          <button
            key={item.num}
            type="button"
            disabled={installPhase === 'downloading' || installPhase === 'verifying'}
            onClick={() => setStep(item.num)}
            className={`text-left px-3 py-2.5 rounded-lg border font-medium transition-colors truncate ${
              step === item.num
                ? 'border-[#0078D4] bg-[#0078D4]/8 dark:bg-[#0078D4]/20 text-[#0078D4] dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* STEP 1: DEVICE ANALYSIS */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t.deviceSelectLabel}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DEVICE_PROFILES.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => handleSelectDevice(prof.id)}
                  className={`text-left p-3.5 rounded-xl border transition-colors ${
                    deviceId === prof.id
                      ? 'border-[#0078D4] bg-[#0078D4]/5 dark:bg-[#0078D4]/15'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {prof.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    {prof.ramGb} GB RAM · {prof.gpuName}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detected Capabilities Grid */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#0078D4]" />
                <span>{t.hardwareMetrics}</span>
              </h3>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Android {device.androidVersion}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">CPU / SoC</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {device.soc}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  {device.cores} cores · ARM64
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">RAM & Storage</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                  {device.ramGb} GB RAM
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {device.freeStorageGb} GB free
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">GPU & Vulkan</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {device.gpuName}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Vulkan {device.vulkanVersion}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Mesa Turnip</div>
                <div
                  className={`font-semibold mt-0.5 ${
                    device.turnipSupported
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {device.turnipSupported
                    ? lang === 'id'
                      ? 'Didukung (Adreno)'
                      : 'Supported (Adreno)'
                    : lang === 'id'
                      ? 'Tidak Tersedia'
                      : 'Unavailable'}
                </div>
              </div>
            </div>

            {/* Recommendation Summary */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-[#0078D4] dark:text-sky-400">
                {t.recommendationTitle}: Easy {device.recommendedEasyProfile.toUpperCase()}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {lang === 'id' ? device.notesId : device.notesEn}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-sm font-semibold transition-colors"
            >
              <span>{t.next}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: EASY / ADVANCED CONFIGURATION */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Mode Tabs */}
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode('easy')}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                mode === 'easy'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.modeEasy}
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                mode === 'advanced'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.modeAdvanced}
            </button>
          </div>

          {mode === 'easy' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">{t.easyDesc}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['light', 'medium', 'advanced'] as EasyProfile[]).map((pKey) => {
                  const isRec = device.recommendedEasyProfile === pKey;
                  const info = t.profiles[pKey];
                  const active = easyProfile === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => setEasyProfile(pKey)}
                      className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                        active
                          ? 'border-[#0078D4] bg-[#0078D4]/5 dark:bg-[#0078D4]/15'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                            {info.name}
                          </span>
                          {isRec && (
                            <span className="text-[11px] font-semibold text-[#0078D4] dark:text-sky-400">
                              {lang === 'id' ? 'Disarankan' : 'Recommended'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                          {info.tagline}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                          {info.detail}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.advancedFields.targetArch}
                  </label>
                  <select
                    value={adv.targetAppArch}
                    onChange={(e) =>
                      setAdv({
                        ...adv,
                        targetAppArch: e.target.value as AdvancedSetupConfig['targetAppArch'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="x86+x64-wow64">x86 + x64 (Wine WoW64 — Recommended)</option>
                    <option value="x64-only">x64 Only</option>
                    <option value="x86-only">x86 (32-bit) Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.advancedFields.runtimeEngine}
                  </label>
                  <select
                    value={adv.runtimeEngine}
                    onChange={(e) =>
                      setAdv({
                        ...adv,
                        runtimeEngine: e.target.value as AdvancedSetupConfig['runtimeEngine'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="wine-wow64-box64">Wine 9.21 WoW64 + Box64 (Terverifikasi)</option>
                    <option value="wine-arm64ec-fex-experimental">
                      Wine ARM64EC + FEX-Emu (Perlu pengujian)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.advancedFields.graphicsBackend}
                  </label>
                  <select
                    value={adv.graphicsBackend}
                    onChange={(e) =>
                      setAdv({
                        ...adv,
                        graphicsBackend: e.target.value as GraphicsBackend,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="turnip-dxvk">Mesa Turnip + DXVK (Adreno)</option>
                    <option value="system-vulkan-dxvk">System Vulkan + DXVK</option>
                    <option value="vkd3d-proton">VKD3D-Proton (DX12)</option>
                    <option value="wined3d-virgl">WineD3D / VirGL (Fallback)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.advancedFields.audioDriver}
                  </label>
                  <select
                    value={adv.audioDriver}
                    onChange={(e) =>
                      setAdv({
                        ...adv,
                        audioDriver: e.target.value as AdvancedSetupConfig['audioDriver'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="pulse-aaudio">PulseAudio → Android AAudio (Low Latency)</option>
                    <option value="pulse-opensl">PulseAudio → OpenSL ES</option>
                    <option value="alsa-null">Null / Disabled</option>
                  </select>
                </div>
              </div>

              {/* Optional Components Checklist */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t.advancedFields.deps}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {systemState.components
                    .filter((c) => !c.essential)
                    .map((c) => {
                      const checked = adv.optionalDependencies.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOptionalDep(c.id)}
                            className="mt-0.5 accent-[#0078D4]"
                          />
                          <div className="text-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {c.name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                              {c.sizeMb} MB · {c.license}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Risk Warning Box if overrides conflict with hardware */}
          {compatibilityRisks.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs space-y-1.5"
            >
              <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t.riskBannerTitle}</span>
              </div>
              <ul className="list-disc pl-5 text-amber-800 dark:text-amber-200 space-y-1">
                {compatibilityRisks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Selected Component Footprint Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-[#0078D4]" />
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {t.selectedComponents}: {selectedComponents.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedComponents.map((c) => c.name.split(' ')[0]).join(' · ')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.estimatedStorage}
              </div>
              <div className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {totalSizeMb} MB
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.back}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(3);
                startInstall();
              }}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-sm font-semibold transition-colors"
            >
              <span>{t.installNow}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: INSTALLATION, VALIDATION & RECOVERY */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  {installPhase === 'done' ? t.verifiedDone : t.installingTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {installPhase === 'done'
                    ? t.verifiedDesc
                    : `${selectedComponents[activeIndex]?.name || ''} · SHA-256 verification`}
                </p>
              </div>
              <span className="font-mono text-lg font-bold text-[#0078D4] dark:text-sky-400 tabular-nums">
                {progress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  installPhase === 'interrupted'
                    ? 'bg-amber-500'
                    : installPhase === 'done'
                      ? 'bg-emerald-600'
                      : 'bg-[#0078D4]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Component Verification List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedComponents.map((comp, idx) => {
                const completed =
                  installPhase === 'done' ||
                  installPhase === 'verifying' ||
                  (progress > 0 && idx < activeIndex);
                const inProgress =
                  (installPhase === 'downloading' || installPhase === 'interrupted') &&
                  idx === activeIndex;
                return (
                  <div
                    key={comp.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {comp.name}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {comp.version}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] tabular-nums shrink-0">
                      {completed ? (
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          SHA-256 OK
                        </span>
                      ) : inProgress ? (
                        <span className="text-[#0078D4] dark:text-sky-400 font-semibold">
                          {installPhase === 'interrupted' ? 'PAUSED' : 'FETCHING'}
                        </span>
                      ) : (
                        <span className="text-slate-400">{comp.sizeMb} MB</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interruption / Recovery Simulation */}
            {installPhase === 'interrupted' && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t.interruptedMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInstallPhase('downloading')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.resumeInstall}</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {installPhase === 'downloading' && (
                <button
                  type="button"
                  onClick={() => setInstallPhase('interrupted')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>{t.simulateDrop}</span>
                </button>
              )}

              {installPhase === 'done' && (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="ml-auto min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.enterLibrary}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
