import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { GitRepoStatus, ResolvedLanguage } from '../types/wphone';

interface AndroidProjectViewProps {
  lang: ResolvedLanguage;
}

interface AndroidFileItem {
  path: string;
  size: number;
}

export const AndroidProjectView: React.FC<AndroidProjectViewProps> = ({ lang }) => {
  const [files, setFiles] = useState<AndroidFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/android/tree').then((r) => r.json()),
      fetch('/api/git/status').then((r) => r.json()),
    ])
      .then(([treeData, gitData]: [{ files: AndroidFileItem[] }, GitRepoStatus]) => {
        setFiles(treeData.files || []);
        setGitStatus(gitData);
        if (treeData.files && treeData.files.length > 0) {
          const preferred =
            treeData.files.find((f) => f.path.endsWith('MainActivity.kt')) || treeData.files[0];
          setSelectedPath(preferred.path);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    fetch(`/api/android/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((data: { content?: string }) => setContent(data.content || ''));
  }, [selectedPath]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {lang === 'id'
              ? 'Rilis Resmi Android 7.0+ & Pipeline GitHub'
              : 'WPhone Official Android 7.0+ Release & GitHub Pipeline'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {lang === 'id'
              ? 'minSdk 24 (Android 7.0–15) · OpenSL ES + Dynamic AAudio · R8 Minified Release APK · GitHub Actions CI'
              : 'minSdk 24 (Android 7.0–15) · OpenSL ES + Dynamic AAudio · R8 Minified Release APK · GitHub Actions CI'}
          </p>
        </div>

        <a
          href="/api/android/export-zip"
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs sm:text-sm font-semibold transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>
            {lang === 'id'
              ? 'Unduh Proyek Android Lengkap (.zip)'
              : 'Download Complete Android Project (.zip)'}
          </span>
        </a>
      </div>

      {/* Git & Release Readiness Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
          <div className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#0078D4]" />
            <span>
              {lang === 'id' ? 'Status Repositori `.git` & GitHub Actions' : '`.git` Repository & GitHub Actions Status'}
            </span>
          </div>

          {gitStatus ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <div className="text-slate-400">Branch</div>
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{gitStatus.branch}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <div className="text-slate-400">HEAD Commit</div>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                    <GitCommitHorizontal className="w-3 h-3" />
                    <span>{gitStatus.shortCommit || '—'}</span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <div className="text-slate-400">Release Tag</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>{gitStatus.latestTag || 'none'}</span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                  <div className="text-slate-400">CI Workflow</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {gitStatus.hasReleaseWorkflow ? 'Ready (.yml)' : 'Missing'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1">
                <div className="text-slate-400">
                  {lang === 'id'
                    ? '# Push ke GitHub untuk memicu build APK release otomatis:'
                    : '# Push to GitHub to trigger automated APK Release build:'}
                </div>
                <div>git remote add origin &lt;YOUR_GITHUB_REPO_URL&gt;</div>
                <div>git push -u origin {gitStatus.branch} --tags</div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500">Reading .git metadata...</div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 text-xs">
          <div className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {lang === 'id'
                ? 'Checklist Keringanan Android < 10 (API 24+)'
                : 'Sub-Android 10 (API 24+) Release Checklist'}
            </span>
          </div>
          {[
            'minSdk = 24 (Android 7.0 Nougat) di seluruh modul app & core-* Gradle + desugaring API 24',
            'Bundled ARM64 runtime (>300 MB APK via scripts/build-android-runtime.sh): libproot.so (jniLibs) + Box64 + Wine WoW64 rootfs (.tar.xz)',
            'Embedded C++17 X11 Display Server (wphone_xserver.cpp) ke ANativeWindow SurfaceView + Direct Touch Mouse',
            'WineWorkspaceActivity Fullscreen sensorLandscape + tombol Exit mengambang & Keyboard dapat disembunyikan',
            'C++ Audio Bridge OpenSL ES + dlopen("libaaudio.so") dinamis + Auto-profile VirGL/BOX64_MMAP32 untuk RAM 2–4 GB',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading Android sources...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#0078D4]" />
              <span>android/ ({files.length} files)</span>
            </div>
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                  selectedPath === file.path
                    ? 'bg-[#0078D4]/10 text-[#0078D4] dark:text-sky-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="font-mono truncate">{file.path}</span>
                <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                  {file.size}B
                </span>
              </button>
            ))}
          </aside>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-sky-400">
              <span className="flex items-center gap-2 truncate">
                <FileCode2 className="w-4 h-4 shrink-0" />
                <span>android/{selectedPath}</span>
              </span>
            </div>
            <pre className="p-4 sm:p-5 text-xs font-mono overflow-x-auto max-h-[600px] leading-relaxed text-slate-200">
              {content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
