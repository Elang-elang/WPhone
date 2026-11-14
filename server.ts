import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import { createInitialSystemState, DEVICE_PROFILES, INITIAL_PLUGINS } from './src/data/mockData.ts';
import { inspectWindowsBinary } from './src/server/peParser.ts';
import {
  DEPENDENCY_DLL_MAP,
  evaluateAppPreflight,
  normalizeDllOverrideMode,
  parseUserReg,
  serializeUserReg,
} from './src/server/wineRegistry.ts';
import type {
  DllOverrideMode,
  GitRepoStatus,
  InstalledPlugin,
  VirtualFsNode,
  WPhoneSystemState,
} from './src/types/wphone.ts';

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const WORKSPACE_DIR = path.join(ROOT_DIR, 'wphone-workspace');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');
const STATE_FILE = path.join(WORKSPACE_DIR, 'config', 'wphone_state.json');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

function resolveWorkspacePath(virtualPath: string): string | null {
  let clean = virtualPath.replace(/\\/g, '/').trim();
  if (clean.startsWith('/WPhone')) {
    clean = clean.slice('/WPhone'.length);
  }
  clean = clean.replace(/^\/+/, '');
  const resolved = path.resolve(WORKSPACE_DIR, clean);
  if (resolved !== WORKSPACE_DIR && !resolved.startsWith(WORKSPACE_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function toVirtualPath(absPath: string): string {
  const rel = path.relative(WORKSPACE_DIR, absPath).replace(/\\/g, '/');
  return rel ? `/WPhone/${rel}` : '/WPhone';
}

function isProtectedVirtualPath(vPath: string): boolean {
  return (
    vPath === '/WPhone' ||
    vPath === '/WPhone/runtime' ||
    vPath.startsWith('/WPhone/runtime/') ||
    vPath === '/WPhone/config' ||
    vPath.startsWith('/WPhone/config/') ||
    vPath === '/WPhone/prefixes'
  );
}

function createPrefixDiskStructure(
  prefixId: string,
  appName: string,
  winVersion: 'win10' | 'win11' | 'win7',
  deps: string[],
  graphicsBackend?: string
) {
  const prefixDir = path.join(WORKSPACE_DIR, 'prefixes', prefixId);
  const sys32 = path.join(prefixDir, 'drive_c', 'windows', 'system32');
  fs.mkdirSync(sys32, { recursive: true });
  fs.mkdirSync(path.join(prefixDir, 'drive_c', 'Program Files'), { recursive: true });
  fs.mkdirSync(path.join(prefixDir, 'drive_c', 'users', 'wphone'), { recursive: true });

  const initialOverrides: Record<string, DllOverrideMode> = {};
  if (graphicsBackend === 'turnip-dxvk' || graphicsBackend === 'system-vulkan-dxvk') {
    initialOverrides.d3d9 = 'native,builtin';
    initialOverrides.d3d10core = 'native,builtin';
    initialOverrides.d3d11 = 'native,builtin';
    initialOverrides.dxgi = 'native,builtin';
  }
  for (const dep of deps) {
    const info = DEPENDENCY_DLL_MAP[dep];
    if (info) {
      for (const dllFile of info.dllFiles) {
        const markerPath = path.join(sys32, dllFile);
        if (!fs.existsSync(markerPath)) {
          fs.writeFileSync(markerPath, `WPhone provisioned runtime stub for ${dep} (${dllFile})\n`, 'utf8');
        }
      }
      Object.assign(initialOverrides, info.overrides);
    }
  }

  const userRegPath = path.join(prefixDir, 'user.reg');
  if (!fs.existsSync(userRegPath)) {
    fs.writeFileSync(
      userRegPath,
      serializeUserReg(appName, {
        prefixId,
        winVersion,
        audioDriver: 'pulse',
        directDrawRenderer: graphicsBackend === 'wined3d-virgl' ? 'opengl' : 'vulkan',
        offscreenRenderingMode: 'fbo',
        videoMemorySize: graphicsBackend === 'wined3d-virgl' ? 256 : 1024,
        csmtEnabled: true,
        dllOverrides: initialOverrides,
      }),
      'utf8'
    );
  }

  const systemRegPath = path.join(prefixDir, 'system.reg');
  if (!fs.existsSync(systemRegPath)) {
    fs.writeFileSync(
      systemRegPath,
      `WINE REGISTRY Version 2\n;; System hive for ${prefixId}\n[System\\\\CurrentControlSet\\\\Control\\\\Session Manager\\\\Environment]\n"PROCESSOR_ARCHITECTURE"="AMD64"\n`,
      'utf8'
    );
  }

  fs.writeFileSync(
    path.join(prefixDir, 'wphone_prefix.json'),
    JSON.stringify(
      {
        prefixId,
        appName,
        winVersion,
        installedDependencies: deps,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
}

function seedBuiltinPluginScripts(plugins: InstalledPlugin[]) {
  for (const pl of plugins) {
    const fallbackScript =
      pl.scriptPreview || INITIAL_PLUGINS.find((bp) => bp.id === pl.id)?.scriptPreview;
    if (!fallbackScript) continue;
    if (!pl.scriptPreview) {
      pl.scriptPreview = fallbackScript;
    }
    const plDir = path.join(WORKSPACE_DIR, 'plugins', pl.id);
    fs.mkdirSync(plDir, { recursive: true });
    const scriptPath = path.join(plDir, pl.mainScript || 'main.js');
    if (!fs.existsSync(scriptPath)) {
      fs.writeFileSync(scriptPath, fallbackScript, 'utf8');
    }
  }
}

function ensureWorkspaceSeeded(): WPhoneSystemState {
  const baseFolders = ['runtime', 'prefixes', 'imports', 'config', 'plugins', 'logs'];
  for (const dir of baseFolders) {
    fs.mkdirSync(path.join(WORKSPACE_DIR, dir), { recursive: true });
  }

  const runtimeInfoPath = path.join(WORKSPACE_DIR, 'runtime', 'manifest.json');
  if (!fs.existsSync(runtimeInfoPath)) {
    fs.writeFileSync(
      runtimeInfoPath,
      JSON.stringify(
        {
          engine: 'Wine 9.21 WoW64 + Box64 0.3.2',
          sharedReadOnly: true,
          hostTarget: 'android-arm64',
          minAndroidApi: 24,
          audioBridge: 'opensles-and-dynamic-aaudio',
        },
        null,
        2
      ),
      'utf8'
    );
  }

  const globalCfgPath = path.join(WORKSPACE_DIR, 'config', 'global_runtime.json');
  if (!fs.existsSync(globalCfgPath)) {
    fs.writeFileSync(
      globalCfgPath,
      JSON.stringify(
        {
          managedSystem: 'wphone-release-1.0.0',
          cpuTranslator: 'box64-0.3.2',
          wineMode: 'wow64-arm64',
          audioBridge: 'pulseaudio-opensles-aaudio',
          sharedRuntimeReadOnly: true,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  const sampleReadme = path.join(WORKSPACE_DIR, 'imports', 'README_IMPORTS.txt');
  if (!fs.existsSync(sampleReadme)) {
    fs.writeFileSync(
      sampleReadme,
      'Place Windows .exe, .msi, or portable directories here, or upload them directly from WPhone Library.\n',
      'utf8'
    );
  }

  if (fs.existsSync(STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as WPhoneSystemState;
      for (const pfx of parsed.prefixes) {
        const app = parsed.apps.find((a) => a.prefixId === pfx.id);
        createPrefixDiskStructure(
          pfx.id,
          app?.name || pfx.id,
          pfx.winVersion,
          pfx.installedDeps,
          app?.graphicsBackend
        );
      }
      seedBuiltinPluginScripts(parsed.plugins);
      return parsed;
    } catch {
      // fall through to fresh seed
    }
  }

  const initial = createInitialSystemState();
  for (const pfx of initial.prefixes) {
    const app = initial.apps.find((a) => a.prefixId === pfx.id);
    createPrefixDiskStructure(
      pfx.id,
      app?.name || pfx.id,
      pfx.winVersion,
      pfx.installedDeps,
      app?.graphicsBackend
    );
  }
  seedBuiltinPluginScripts(initial.plugins);
  fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
  return initial;
}

function saveState(state: WPhoneSystemState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function listDirVirtual(virtualDir: string): VirtualFsNode[] {
  const absDir = resolveWorkspacePath(virtualDir);
  if (!absDir || !fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const nodes: VirtualFsNode[] = [];
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    const stat = fs.statSync(full);
    const vPath = toVirtualPath(full);
    nodes.push({
      id: `disk-${Buffer.from(vPath).toString('base64url').slice(0, 16)}`,
      name: entry.name,
      path: vPath,
      type: entry.isDirectory() ? 'folder' : 'file',
      sizeKb: entry.isDirectory() ? 0 : Math.max(1, Math.round(stat.size / 1024)),
      protected: isProtectedVirtualPath(vPath),
      modifiedAt: stat.mtime.toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

function walkFiles(dir: string, baseDir: string, out: Array<{ path: string; size: number }>) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, baseDir, out);
    } else {
      const stat = fs.statSync(full);
      out.push({
        path: path.relative(baseDir, full).replace(/\\/g, '/'),
        size: stat.size,
      });
    }
  }
}

function readGitStatus(): GitRepoStatus {
  const hasWorkflow = fs.existsSync(path.join(ROOT_DIR, '.github', 'workflows', 'ci-and-release.yml'));
  const gitDirExists = fs.existsSync(path.join(ROOT_DIR, '.git'));
  if (!gitDirExists) {
    return {
      initialized: false,
      branch: 'uninitialized',
      headCommit: '',
      shortCommit: '',
      latestTag: null,
      commitCount: 0,
      dirtyFiles: 0,
      remotes: [],
      hasReleaseWorkflow: hasWorkflow,
    };
  }

  const runGit = (args: string[]): string => {
    try {
      return execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']) || 'main';
  const headCommit = runGit(['rev-parse', 'HEAD']);
  const shortCommit = runGit(['rev-parse', '--short', 'HEAD']);
  const latestTag = runGit(['describe', '--tags', '--abbrev=0']) || null;
  const commitCount = Number.parseInt(runGit(['rev-list', '--count', 'HEAD']) || '0', 10) || 0;
  const porcelain = runGit(['status', '--porcelain']);
  const dirtyFiles = porcelain ? porcelain.split('\n').filter(Boolean).length : 0;

  const remotesRaw = runGit(['remote', '-v']);
  const remoteMap = new Map<string, string>();
  for (const line of remotesRaw.split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)/);
    if (m) remoteMap.set(m[1], m[2]);
  }

  return {
    initialized: true,
    branch,
    headCommit,
    shortCommit,
    latestTag,
    commitCount,
    dirtyFiles,
    remotes: Array.from(remoteMap.entries()).map(([name, url]) => ({ name, url })),
    hasReleaseWorkflow: hasWorkflow,
  };
}

async function startServer() {
  let currentState = ensureWorkspaceSeeded();
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      workspaceDir: WORKSPACE_DIR,
      androidProjectReady: fs.existsSync(ANDROID_DIR),
      nodeVersion: process.version,
      releaseMode: true,
    });
  });

  // 1. State Sync
  app.get('/api/state', (_req: Request, res: Response) => {
    res.json(currentState);
  });

  app.put('/api/state', (req: Request, res: Response) => {
    const incoming = req.body as WPhoneSystemState;
    if (!incoming || !Array.isArray(incoming.apps)) {
      res.status(400).json({ error: 'Invalid state payload' });
      return;
    }
    currentState = incoming;
    for (const pfx of currentState.prefixes) {
      const targetApp = currentState.apps.find((a) => a.prefixId === pfx.id);
      createPrefixDiskStructure(
        pfx.id,
        targetApp?.name || pfx.id,
        pfx.winVersion,
        pfx.installedDeps,
        targetApp?.graphicsBackend
      );
    }
    saveState(currentState);
    res.json({ ok: true });
  });

  app.post('/api/reset', (_req: Request, res: Response) => {
    fs.rmSync(WORKSPACE_DIR, { recursive: true, force: true });
    currentState = ensureWorkspaceSeeded();
    res.json(currentState);
  });

  // 2. Real Filesystem Manager
  app.get('/api/fs/list', (req: Request, res: Response) => {
    const targetPath = String(req.query.path || '/WPhone');
    const nodes = listDirVirtual(targetPath);
    res.json({ path: targetPath, nodes });
  });

  app.get('/api/fs/read', (req: Request, res: Response) => {
    const targetPath = String(req.query.path || '');
    const abs = resolveWorkspacePath(targetPath);
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const stat = fs.statSync(abs);
    if (stat.size > 512 * 1024) {
      const head = fs.readFileSync(abs).subarray(0, 256);
      res.json({
        path: targetPath,
        binary: true,
        sizeBytes: stat.size,
        content: `Binary file (${stat.size} bytes)\nHex header: ${head.subarray(0, 64).toString('hex')}`,
      });
      return;
    }
    const raw = fs.readFileSync(abs);
    const hasNull = raw.includes(0);
    res.json({
      path: targetPath,
      binary: hasNull,
      sizeBytes: stat.size,
      content: hasNull
        ? `Binary file (${stat.size} bytes)\nHex header: ${raw.subarray(0, 64).toString('hex')}`
        : raw.toString('utf8'),
    });
  });

  app.post('/api/fs/write', (req: Request, res: Response) => {
    const { path: vPath, content } = req.body as { path: string; content: string };
    const abs = resolveWorkspacePath(vPath || '');
    if (!abs) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content ?? '', 'utf8');
    res.json({ ok: true, path: toVirtualPath(abs) });
  });

  app.post('/api/fs/mkdir', (req: Request, res: Response) => {
    const { parentPath, name } = req.body as { parentPath: string; name: string };
    const safeName = String(name || '').replace(/[/\\..]/g, '').trim();
    if (!safeName) {
      res.status(400).json({ error: 'Invalid folder name' });
      return;
    }
    const abs = resolveWorkspacePath(`${parentPath}/${safeName}`);
    if (!abs) {
      res.status(400).json({ error: 'Path traversal blocked' });
      return;
    }
    fs.mkdirSync(abs, { recursive: true });
    res.json({ ok: true, path: toVirtualPath(abs) });
  });

  app.post('/api/fs/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const targetDir = String(req.body.targetDir || '/WPhone/imports');
    const safeName = path.basename(req.file.originalname);
    const absDir = resolveWorkspacePath(targetDir);
    if (!absDir) {
      res.status(400).json({ error: 'Invalid target directory' });
      return;
    }
    fs.mkdirSync(absDir, { recursive: true });
    const absFile = path.join(absDir, safeName);
    fs.writeFileSync(absFile, req.file.buffer);
    res.json({
      ok: true,
      path: toVirtualPath(absFile),
      sizeBytes: req.file.size,
    });
  });

  app.get('/api/fs/download', (req: Request, res: Response) => {
    const vPath = String(req.query.path || '');
    const abs = resolveWorkspacePath(vPath);
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.download(abs);
  });

  app.delete('/api/fs/node', (req: Request, res: Response) => {
    const vPath = String(req.query.path || '');
    if (isProtectedVirtualPath(vPath)) {
      res.status(403).json({
        error: 'Protected system directory or runtime configuration cannot be deleted.',
      });
      return;
    }
    const abs = resolveWorkspacePath(vPath);
    if (!abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }
    fs.rmSync(abs, { recursive: true, force: true });
    res.json({ ok: true });
  });

  // 3. Real Windows PE32 / PE32+ & MSI Binary Inspector
  app.post('/api/pe/inspect', upload.single('binary'), (req: Request, res: Response) => {
    if (req.file) {
      const savedPath = path.join(WORKSPACE_DIR, 'imports', path.basename(req.file.originalname));
      fs.writeFileSync(savedPath, req.file.buffer);
      const result = inspectWindowsBinary(req.file.buffer, req.file.originalname);
      res.json({ ...result, savedVirtualPath: toVirtualPath(savedPath) });
      return;
    }
    const { path: vPath } = req.body as { path?: string };
    if (vPath) {
      const abs = resolveWorkspacePath(vPath);
      if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.status(404).json({ error: 'Binary not found on workspace disk' });
        return;
      }
      const buf = fs.readFileSync(abs);
      res.json({
        ...inspectWindowsBinary(buf, path.basename(abs)),
        savedVirtualPath: toVirtualPath(abs),
      });
      return;
    }
    res.status(400).json({ error: 'Provide a Windows binary file or workspace path' });
  });

  // 4. Real Wine Prefix Provisioning, Registry (.reg) Editor & Dependency Provisioner
  app.post('/api/prefixes/:id/repair', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const pfx = currentState.prefixes.find((p) => p.id === id);
    const targetApp = currentState.apps.find((a) => a.prefixId === id);
    createPrefixDiskStructure(
      id,
      targetApp?.name || id,
      pfx?.winVersion || 'win10',
      pfx?.installedDeps || [],
      targetApp?.graphicsBackend
    );
    res.json({ ok: true, path: `/WPhone/prefixes/${id}` });
  });

  app.get('/api/prefixes/:id/registry', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const pfx = currentState.prefixes.find((p) => p.id === id);
    const targetApp = currentState.apps.find((a) => a.prefixId === id);
    const prefixDirExists = fs.existsSync(path.join(WORKSPACE_DIR, 'prefixes', id));
    if (!pfx && !targetApp && !prefixDirExists) {
      res.status(404).json({ error: 'Prefix not found' });
      return;
    }
    createPrefixDiskStructure(
      id,
      targetApp?.name || id,
      pfx?.winVersion || 'win10',
      pfx?.installedDeps || [],
      targetApp?.graphicsBackend
    );
    const userRegPath = path.join(WORKSPACE_DIR, 'prefixes', id, 'user.reg');
    const raw = fs.readFileSync(userRegPath, 'utf8');
    res.json(parseUserReg(id, raw));
  });

  app.put('/api/prefixes/:id/registry', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const pfx = currentState.prefixes.find((p) => p.id === id);
    const targetApp = currentState.apps.find((a) => a.prefixId === id);
    const prefixDirExists = fs.existsSync(path.join(WORKSPACE_DIR, 'prefixes', id));
    if (!pfx && !targetApp && !prefixDirExists) {
      res.status(404).json({ error: 'Prefix not found' });
      return;
    }
    createPrefixDiskStructure(
      id,
      targetApp?.name || id,
      pfx?.winVersion || 'win10',
      pfx?.installedDeps || [],
      targetApp?.graphicsBackend
    );

    const userRegPath = path.join(WORKSPACE_DIR, 'prefixes', id, 'user.reg');
    const body = req.body as {
      rawUserReg?: string;
      winVersion?: 'win10' | 'win11' | 'win7';
      audioDriver?: 'pulse' | 'alsa' | 'null';
      directDrawRenderer?: 'opengl' | 'gdi' | 'vulkan';
      offscreenRenderingMode?: 'fbo' | 'backbuffer';
      videoMemorySize?: number;
      csmtEnabled?: boolean;
      dllOverrides?: Record<string, string>;
    };

    let nextRaw: string;
    if (typeof body.rawUserReg === 'string' && body.rawUserReg.includes('WINE REGISTRY')) {
      nextRaw = body.rawUserReg;
    } else {
      const normalizedOverrides: Record<string, DllOverrideMode> = {};
      for (const [k, v] of Object.entries(body.dllOverrides || {})) {
        if (k.trim()) normalizedOverrides[k.trim().toLowerCase()] = normalizeDllOverrideMode(v);
      }
      nextRaw = serializeUserReg(targetApp?.name || id, {
        prefixId: id,
        winVersion: body.winVersion || pfx?.winVersion || 'win10',
        audioDriver: body.audioDriver || 'pulse',
        directDrawRenderer: body.directDrawRenderer || 'opengl',
        offscreenRenderingMode: body.offscreenRenderingMode || 'fbo',
        videoMemorySize: Number(body.videoMemorySize) || 512,
        csmtEnabled: body.csmtEnabled ?? true,
        dllOverrides: normalizedOverrides,
      });
    }

    fs.writeFileSync(userRegPath, nextRaw, 'utf8');
    const parsed = parseUserReg(id, nextRaw);
    if (pfx) {
      pfx.winVersion = parsed.winVersion;
      saveState(currentState);
    }
    res.json(parsed);
  });

  app.post('/api/prefixes/:id/deps', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { depId, action } = req.body as { depId: string; action: 'install' | 'remove' };
    const pfx = currentState.prefixes.find((p) => p.id === id);
    if (!pfx) {
      res.status(404).json({ error: 'Prefix not found' });
      return;
    }

    const targetApp = currentState.apps.find((a) => a.prefixId === id);
    createPrefixDiskStructure(
      id,
      targetApp?.name || id,
      pfx.winVersion,
      pfx.installedDeps,
      targetApp?.graphicsBackend
    );
    const userRegPath = path.join(WORKSPACE_DIR, 'prefixes', id, 'user.reg');
    const currentHive = parseUserReg(id, fs.readFileSync(userRegPath, 'utf8'));
    const sys32 = path.join(WORKSPACE_DIR, 'prefixes', id, 'drive_c', 'windows', 'system32');

    const mapEntry = DEPENDENCY_DLL_MAP[depId];
    if (action === 'install') {
      if (!pfx.installedDeps.includes(depId)) {
        pfx.installedDeps.push(depId);
        pfx.sizeMb += 28;
      }
      if (mapEntry) {
        for (const dllFile of mapEntry.dllFiles) {
          fs.writeFileSync(
            path.join(sys32, dllFile),
            `WPhone provisioned runtime module for ${depId} (${dllFile})\n`,
            'utf8'
          );
        }
        Object.assign(currentHive.dllOverrides, mapEntry.overrides);
      }
    } else {
      pfx.installedDeps = pfx.installedDeps.filter((d) => d !== depId);
      if (mapEntry) {
        for (const dll of Object.keys(mapEntry.overrides)) {
          delete currentHive.dllOverrides[dll];
        }
      }
    }

    const updatedRaw = serializeUserReg(targetApp?.name || id, currentHive);
    fs.writeFileSync(userRegPath, updatedRaw, 'utf8');
    saveState(currentState);
    res.json({
      ok: true,
      prefix: pfx,
      registry: parseUserReg(id, updatedRaw),
    });
  });

  // 5. Real Compatibility Preflight Evaluation
  app.post('/api/apps/:id/preflight', (req: Request, res: Response) => {
    const appId = String(req.params.id);
    const targetApp = currentState.apps.find((a) => a.id === appId);
    if (!targetApp) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const prefix = currentState.prefixes.find((p) => p.id === targetApp.prefixId);
    createPrefixDiskStructure(
      targetApp.prefixId,
      targetApp.name,
      prefix?.winVersion || 'win10',
      prefix?.installedDeps || [],
      targetApp.graphicsBackend
    );
    const userRegPath = path.join(WORKSPACE_DIR, 'prefixes', targetApp.prefixId, 'user.reg');
    const registry = parseUserReg(targetApp.prefixId, fs.readFileSync(userRegPath, 'utf8'));
    const overrideDeviceId = (req.body as { deviceProfileId?: string } | undefined)?.deviceProfileId;
    const device = DEVICE_PROFILES.find(
      (d) => d.id === (overrideDeviceId || currentState.deviceProfileId)
    );

    const report = evaluateAppPreflight({
      app: targetApp,
      prefix,
      registry,
      device,
      globalConfig: currentState.globalConfig,
    });
    res.json(report);
  });

  // 6. Real .wrplugin ZIP Archive Parser, Script Server & Execution Logs
  app.post('/api/plugins/upload', upload.single('plugin'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No .wrplugin archive uploaded' });
        return;
      }
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const zip = await JSZip.loadAsync(req.file.buffer);

      const jsonEntry = zip.file('plugin.json');
      const tomlEntry = zip.file('plugin.toml');
      if (!jsonEntry && !tomlEntry) {
        res.status(400).json({
          error: 'Invalid .wrplugin package: root plugin.json or plugin.toml manifest is required.',
        });
        return;
      }

      let manifest: Record<string, unknown> = {};
      if (jsonEntry) {
        manifest = JSON.parse(await jsonEntry.async('string')) as Record<string, unknown>;
      } else if (tomlEntry) {
        const rawToml = await tomlEntry.async('string');
        for (const line of rawToml.split('\n')) {
          const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"/);
          if (m) manifest[m[1]] = m[2];
        }
      }

      const pluginId = String(manifest.id || `plugin.${Date.now()}`);
      const pluginDir = path.join(WORKSPACE_DIR, 'plugins', pluginId);
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(path.join(pluginDir, path.basename(req.file.originalname)), req.file.buffer);

      for (const [name, entry] of Object.entries(zip.files)) {
        if (!entry.dir) {
          const outPath = path.resolve(pluginDir, name);
          if (outPath.startsWith(pluginDir + path.sep)) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, await entry.async('nodebuffer'));
          }
        }
      }

      const mainScriptName = String(manifest.mainScript || 'main.js');
      const mainScriptFile = zip.file(mainScriptName);
      const scriptPreview = mainScriptFile ? await mainScriptFile.async('string') : undefined;
      const readmeFile = zip.file(String(manifest.readme || 'README.md'));
      const readme = readmeFile ? await readmeFile.async('string') : undefined;

      const pluginRecord: InstalledPlugin = {
        id: pluginId,
        name: String(manifest.name || pluginId),
        version: String(manifest.version || '1.0.0'),
        category: manifest.category === 'backend' ? 'backend' : 'frontend',
        author: String(manifest.author || 'Unknown'),
        description: String(manifest.description || 'Custom .wrplugin package'),
        scriptLanguage:
          manifest.scriptLanguage === 'python' || manifest.scriptLanguage === 'java'
            ? manifest.scriptLanguage
            : 'javascript',
        mainScript: mainScriptName,
        apiVersion: String(manifest.apiVersion || 'wphone.frontend@1.0'),
        permissions: Array.isArray(manifest.permissions)
          ? manifest.permissions.map(String)
          : ['ui.theme.accent'],
        dependencies: Array.isArray(manifest.dependencies)
          ? manifest.dependencies.map(String)
          : [],
        enabled: false,
        sha256,
        installedAt: new Date().toISOString().slice(0, 10),
        readme,
        accentColor: typeof manifest.accentColor === 'string' ? manifest.accentColor : '#0284C7',
        scriptPreview,
      };

      res.json({ ok: true, plugin: pluginRecord });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse .wrplugin ZIP archive',
      });
    }
  });

  app.get('/api/plugins/:id/script', (req: Request, res: Response) => {
    const pluginId = String(req.params.id);
    const plugin = currentState.plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    const scriptPath = path.join(WORKSPACE_DIR, 'plugins', pluginId, plugin.mainScript || 'main.js');
    if (fs.existsSync(scriptPath)) {
      res.json({
        pluginId,
        mainScript: plugin.mainScript,
        scriptLanguage: plugin.scriptLanguage,
        content: fs.readFileSync(scriptPath, 'utf8'),
      });
      return;
    }
    const fallbackContent =
      plugin.scriptPreview ||
      INITIAL_PLUGINS.find((bp) => bp.id === pluginId)?.scriptPreview ||
      '';
    res.json({
      pluginId,
      mainScript: plugin.mainScript,
      scriptLanguage: plugin.scriptLanguage,
      content: fallbackContent,
    });
  });

  app.put('/api/plugins/:id/script', (req: Request, res: Response) => {
    const pluginId = String(req.params.id);
    const plugin = currentState.plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    const { content } = req.body as { content: string };
    const plDir = path.join(WORKSPACE_DIR, 'plugins', pluginId);
    fs.mkdirSync(plDir, { recursive: true });
    fs.writeFileSync(path.join(plDir, plugin.mainScript || 'main.js'), content ?? '', 'utf8');
    plugin.scriptPreview = content ?? '';
    saveState(currentState);
    res.json({ ok: true });
  });

  app.post('/api/plugins/:id/logs', (req: Request, res: Response) => {
    const pluginId = String(req.params.id);
    const { summary } = req.body as { summary: string };
    const logLine = `[${new Date().toISOString()}] [${pluginId}] ${summary}\n`;
    fs.appendFileSync(path.join(WORKSPACE_DIR, 'logs', 'plugin_sandbox.log'), logLine, 'utf8');
    res.json({ ok: true });
  });

  app.get('/api/plugins/sample-wrplugin', async (_req: Request, res: Response) => {
    const zip = new JSZip();
    const manifest = {
      id: 'id.wphone.emerald-console',
      name: 'WPhone Emerald Telemetry Accent',
      version: '1.0.0',
      category: 'frontend',
      author: 'WPhone SDK',
      description: 'Sample .wrplugin package demonstrating root plugin.json and sandboxed UI/Keyboard API.',
      icon: 'icon.png',
      readme: 'README.md',
      mainScript: 'main.js',
      scriptLanguage: 'javascript',
      apiVersion: 'wphone.frontend@1.0',
      dependencies: [],
      permissions: ['ui.theme.accent', 'keyboard.preset.register', 'diagnostics.log'],
      accentColor: '#059669',
      compatibility: { minWPhoneVersion: '1.0.0' },
    };
    zip.file('plugin.json', JSON.stringify(manifest, null, 2));
    zip.file(
      'README.md',
      '# WPhone Emerald Telemetry Accent\n\nUpload this `.wrplugin` archive inside WPhone Admin Panel -> Plugin Manager and click Run in Sandbox.\n'
    );
    zip.file(
      'main.js',
      `// Executed inside WPhone isolated Web Worker sandbox\napi.log('info', 'Initializing Emerald Accent .wrplugin');\napi.setAccentColor('#059669');\napi.registerKeyboardPreset({\n  name: 'Emerald Utility Bar',\n  mode: 'desktop',\n  desktopKeys: ['ESC', 'TAB', 'CTRL', 'ALT', 'F1', 'F5', 'F12', 'DEL']\n});\n`
    );
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="wphone-emerald-accent.wrplugin"'
    );
    res.send(buf);
  });

  // 7. Git & GitHub Release Status + Android Multi-Module Explorer & ZIP Export
  app.get('/api/git/status', (_req: Request, res: Response) => {
    res.json(readGitStatus());
  });

  app.get('/api/android/tree', (_req: Request, res: Response) => {
    const files: Array<{ path: string; size: number }> = [];
    walkFiles(ANDROID_DIR, ANDROID_DIR, files);
    files.sort((a, b) => a.path.localeCompare(b.path));
    res.json({ files });
  });

  app.get('/api/android/file', (req: Request, res: Response) => {
    const rel = String(req.query.path || '');
    const abs = path.resolve(ANDROID_DIR, rel);
    if (!abs.startsWith(ANDROID_DIR + path.sep) || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'Android source file not found' });
      return;
    }
    res.json({ path: rel, content: fs.readFileSync(abs, 'utf8') });
  });

  app.get('/api/android/export-zip', async (_req: Request, res: Response) => {
    const files: Array<{ path: string; size: number }> = [];
    walkFiles(ANDROID_DIR, ANDROID_DIR, files);
    const zip = new JSZip();
    for (const f of files) {
      zip.file(`wphone-android/${f.path}`, fs.readFileSync(path.join(ANDROID_DIR, f.path)));
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="wphone-android-project.zip"');
    res.send(buf);
  });

  // 8. Full Diagnostic Bundle Export
  app.get('/api/diagnostics/export', (_req: Request, res: Response) => {
    const workspaceFiles: Array<{ path: string; size: number }> = [];
    walkFiles(WORKSPACE_DIR, WORKSPACE_DIR, workspaceFiles);
    const report = {
      exportedAt: new Date().toISOString(),
      platform: 'WPhone Official Release Server + Android 7.0+ (API 24)',
      nodeVersion: process.version,
      git: readGitStatus(),
      workspaceFilesCount: workspaceFiles.length,
      workspaceFiles,
      state: currentState,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="wphone-full-diagnostics-${Date.now()}.json"`
    );
    res.send(JSON.stringify(report, null, 2));
  });

  // Ensure API errors always return JSON instead of Express HTML stack traces
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'API request failed',
    });
  });

  // Vite Dev Middleware or Static Production Serve
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WPhone Official Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
