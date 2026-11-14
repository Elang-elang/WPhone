import { InstalledPlugin, PluginSandboxExecutionResult } from '../types/wphone';

export function executePluginInSandbox(
  plugin: InstalledPlugin,
  scriptCode: string
): Promise<PluginSandboxExecutionResult> {
  const start = performance.now();

  if (plugin.scriptLanguage !== 'javascript') {
    return Promise.resolve({
      pluginId: plugin.id,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      logs: [
        {
          level: 'warn',
          message: `Script language "${plugin.scriptLanguage}" targets Android backend host bridge (${plugin.apiVersion}) and cannot execute natively inside browser Worker.`,
        },
      ],
      error: 'Backend Python/Java scripts execute via Android host bridge.',
    });
  }

  return new Promise((resolve) => {
    const permissions = new Set(plugin.permissions);

    const workerBootstrap = `
      self.fetch = function() { throw new Error('Network access blocked in WPhone plugin sandbox'); };
      self.XMLHttpRequest = function() { throw new Error('XHR blocked in WPhone plugin sandbox'); };
      self.WebSocket = function() { throw new Error('WebSocket blocked in WPhone plugin sandbox'); };

      self.onmessage = function(event) {
        const { code, perms } = event.data;
        const permSet = new Set(perms || []);
        const logs = [];
        let appliedAccentColor = undefined;
        let suggestedEnv = undefined;
        let registeredPreset = undefined;

        const api = {
          log: function(level, message) {
            if (!permSet.has('diagnostics.log') && level !== 'info') {
              logs.push({ level: 'denied', message: 'Blocked api.log(' + level + '): missing permission diagnostics.log' });
              return;
            }
            logs.push({ level: level === 'warn' || level === 'error' ? level : 'info', message: String(message) });
          },
          setAccentColor: function(hex) {
            if (!permSet.has('ui.theme.accent')) {
              logs.push({ level: 'denied', message: 'Blocked api.setAccentColor: missing permission ui.theme.accent' });
              return false;
            }
            if (!/^#[0-9a-fA-F]{6}$/.test(String(hex))) {
              logs.push({ level: 'warn', message: 'Ignored invalid hex accent color: ' + String(hex) });
              return false;
            }
            appliedAccentColor = String(hex);
            logs.push({ level: 'info', message: 'Applied UI accent color ' + appliedAccentColor });
            return true;
          },
          suggestPrefixEnv: function(envMap) {
            if (!permSet.has('prefix.env.suggest') && !permSet.has('runtime.env.write')) {
              logs.push({ level: 'denied', message: 'Blocked api.suggestPrefixEnv: missing permission prefix.env.suggest' });
              return false;
            }
            suggestedEnv = {};
            for (const [k, v] of Object.entries(envMap || {})) {
              suggestedEnv[String(k)] = String(v);
            }
            logs.push({ level: 'info', message: 'Queued prefix env overrides: ' + Object.keys(suggestedEnv).join(', ') });
            return true;
          },
          registerKeyboardPreset: function(preset) {
            if (!permSet.has('keyboard.preset.register')) {
              logs.push({ level: 'denied', message: 'Blocked api.registerKeyboardPreset: missing permission keyboard.preset.register' });
              return false;
            }
            registeredPreset = preset && typeof preset === 'object' ? {
              name: String(preset.name || 'Plugin Preset'),
              mode: preset.mode === 'gaming' ? 'gaming' : 'desktop',
              desktopKeys: Array.isArray(preset.desktopKeys) ? preset.desktopKeys.map(String) : ['ESC', 'TAB', 'CTRL', 'ALT']
            } : undefined;
            if (registeredPreset) {
              logs.push({ level: 'info', message: 'Registered keyboard preset: ' + registeredPreset.name });
            }
            return Boolean(registeredPreset);
          }
        };

        try {
          const cleanCode = String(code).replace(/^\\s*export\\s+/gm, '');
          const fn = new Function('api', cleanCode + '\\nif (typeof onEnable === "function" && !globalThis.__wphone_called) { globalThis.__wphone_called = true; }');
          fn(api);
          self.postMessage({ ok: true, logs, appliedAccentColor, suggestedEnv, registeredPreset });
        } catch (err) {
          logs.push({ level: 'error', message: err && err.message ? err.message : String(err) });
          self.postMessage({ ok: false, logs, error: err && err.message ? err.message : String(err) });
        }
      };
    `;

    const blob = new Blob([workerBootstrap], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timer = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        pluginId: plugin.id,
        ok: false,
        durationMs: Math.round(performance.now() - start),
        logs: [{ level: 'error', message: 'Sandbox execution timed out after 1500ms.' }],
        error: 'Execution timeout (1500ms)',
      });
    }, 1500);

    worker.onmessage = (e: MessageEvent) => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      const data = e.data as {
        ok: boolean;
        logs: PluginSandboxExecutionResult['logs'];
        appliedAccentColor?: string;
        suggestedEnv?: Record<string, string>;
        registeredPreset?: { name: string; mode: 'desktop' | 'gaming'; desktopKeys: string[] };
        error?: string;
      };
      resolve({
        pluginId: plugin.id,
        ok: data.ok,
        durationMs: Math.round(performance.now() - start),
        appliedAccentColor: data.appliedAccentColor,
        suggestedEnv: data.suggestedEnv,
        registeredPresetName: data.registeredPreset?.name,
        logs: data.logs || [],
        error: data.error,
      });
    };

    worker.onerror = (err) => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        pluginId: plugin.id,
        ok: false,
        durationMs: Math.round(performance.now() - start),
        logs: [{ level: 'error', message: err.message || 'Sandbox worker error' }],
        error: err.message || 'Sandbox worker error',
      });
    };

    worker.postMessage({ code: scriptCode, perms: Array.from(permissions) });
  });
}
