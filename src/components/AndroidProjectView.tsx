import React, { useEffect, useState } from 'react';
import { Download, FileCode2, FolderGit2 } from 'lucide-react';
import { ResolvedLanguage } from '../types/wphone';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/android/tree')
      .then((r) => r.json())
      .then((data: { files: AndroidFileItem[] }) => {
        setFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          const preferred =
            data.files.find((f) => f.path.endsWith('MainActivity.kt')) || data.files[0];
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
              ? 'Proyek Native Android Studio (Multi-Modul)'
              : 'Native Android Studio Project (Multi-Module)'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {lang === 'id'
              ? 'Kotlin · Jetpack Compose · C++/JNI NDK · CMake · AAudio Bridge · PE32/PE32+ Inspector'
              : 'Kotlin · Jetpack Compose · C++/JNI NDK · CMake · AAudio Bridge · PE32/PE32+ Inspector'}
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
