import React, { useMemo, useState } from 'react';
import {
  FileCode2,
  FileSpreadsheet,
  FolderArchive,
  Gamepad2,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  AppWindow,
} from 'lucide-react';
import { AppCategory, ResolvedLanguage, WindowsAppEntry } from '../types/wphone';
import { translations } from '../i18n/translations';
import { WPhoneIcon } from './WPhoneIcon';

interface AppLibraryProps {
  apps: WindowsAppEntry[];
  lang: ResolvedLanguage;
  compactFrame: boolean;
  onLaunchApp: (app: WindowsAppEntry) => void;
  onEditApp: (app: WindowsAppEntry) => void;
  onUnregisterApp: (appId: string) => void;
  onOpenAddModal: () => void;
}

const renderAppGlyph = (iconKey: string) => {
  const cls = 'w-5 h-5 text-[#0078D4] dark:text-sky-400';
  switch (iconKey) {
    case 'editor':
    case 'code':
      return <FileCode2 className={cls} />;
    case 'sheet':
      return <FileSpreadsheet className={cls} />;
    case 'archive':
      return <FolderArchive className={cls} />;
    case 'gamepad':
      return <Gamepad2 className={cls} />;
    default:
      return <AppWindow className={cls} />;
  }
};

export const AppLibrary: React.FC<AppLibraryProps> = ({
  apps,
  lang,
  compactFrame,
  onLaunchApp,
  onEditApp,
  onUnregisterApp,
  onOpenAddModal,
}) => {
  const t = translations[lang].library;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | AppCategory>('All');
  const [sortBy, setSortBy] = useState<'name' | 'lastRun' | 'arch'>('name');

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps
      .filter((app) => {
        if (category !== 'All' && app.category !== category) return false;
        if (!q) return true;
        return (
          app.name.toLowerCase().includes(q) ||
          app.prefixId.toLowerCase().includes(q) ||
          app.executablePath.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'arch') return a.arch.localeCompare(b.arch);
        const la = a.lastRunAt || '';
        const lb = b.lastRunAt || '';
        return lb.localeCompare(la);
      });
  }, [apps, search, category, sortBy]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WPhoneIcon variant="internal" className="w-8 h-8" alt="Windows Apps" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {t.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addApp}</span>
        </button>
      </div>

      {/* Search & Sort Row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-[#0078D4] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.sortBy}:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'lastRun' | 'arch')}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          >
            <option value="name">{t.sortName}</option>
            <option value="lastRun">{t.sortLastRun}</option>
            <option value="arch">{t.sortArch}</option>
          </select>
        </div>
      </div>

      {/* Interactive Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['All', 'Productivity', 'Utilities', 'DevTools', 'Games'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              category === cat
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.categories[cat]}
          </button>
        ))}
      </div>

      {/* App Cards Grid (Zero-Pill Clean Metadata) */}
      {filteredApps.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
          <div className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t.emptyTitle}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {t.emptyDesc}
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0078D4] text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addApp}</span>
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-3 ${
            compactFrame ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {renderAppGlyph(app.iconKey)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                      {app.name}
                    </h3>
                    {/* Unboxed clean metadata with middot separators */}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5 tabular-nums">
                      <span>{t.categories[app.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{app.arch}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono truncate">{app.prefixId}</span>
                    </div>
                  </div>
                </div>

                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
                  {app.executablePath}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 tabular-nums">
                  <span>
                    {app.keyboardMode === 'gaming'
                      ? lang === 'id'
                        ? 'Keyboard: Gaming Pad'
                        : 'Keyboard: Gaming Pad'
                      : lang === 'id'
                        ? 'Keyboard: Desktop + IME'
                        : 'Keyboard: Desktop + IME'}
                  </span>
                  <span>{app.lastRunAt ? app.lastRunAt : t.lastRunNever}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLaunchApp(app)}
                  className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white text-xs font-semibold transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.launch}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEditApp(app)}
                  title={t.configure}
                  aria-label={`${t.configure} ${app.name}`}
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUnregisterApp(app.id)}
                  title={t.unregister}
                  aria-label={`${t.unregister} ${app.name}`}
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
