import React, { useState } from 'react';
import { X, Search, BookOpen, ChevronRight } from 'lucide-react';
import { ResolvedLanguage } from '../types/wphone';
import { translations } from '../i18n/translations';
import { HELPER_ARTICLES } from '../data/helperData';

interface HelperDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: ResolvedLanguage;
}

export const HelperDrawer: React.FC<HelperDrawerProps> = ({ open, onClose, lang }) => {
  const [query, setQuery] = useState('');
  const [activeArticleId, setActiveArticleId] = useState<string>(HELPER_ARTICLES[0].id);
  const t = translations[lang].helper;

  if (!open) return null;

  const filtered = HELPER_ARTICLES.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const title = (lang === 'id' ? a.topicId : a.topicEn).toLowerCase();
    const summary = (lang === 'id' ? a.summaryId : a.summaryEn).toLowerCase();
    const pts = (lang === 'id' ? a.pointsId : a.pointsEn).join(' ').toLowerCase();
    return title.includes(q) || summary.includes(q) || pts.includes(q);
  });

  const selected = filtered.find((a) => a.id === activeArticleId) || filtered[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {t.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                lang === 'id'
                  ? 'Cari topik (misal: Box64, Mali, vcrun2022, .wrplugin)...'
                  : 'Search help topics (e.g., Box64, Mali, vcrun2022, .wrplugin)...'
              }
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-transparent focus:border-[#0078D4] focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Topic Selector List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((article) => {
              const isActive = selected?.id === article.id;
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setActiveArticleId(article.id)}
                  className={`text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? 'border-[#0078D4] bg-[#0078D4]/5 dark:bg-[#0078D4]/15 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold leading-snug">
                    {lang === 'id' ? article.topicId : article.topicEn}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-[#0078D4] dark:text-sky-400">
                <BookOpen className="w-4 h-4" />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  {lang === 'id' ? selected.topicId : selected.topicEn}
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'id' ? selected.summaryId : selected.summaryEn}
              </p>
              <ul className="space-y-2.5">
                {(lang === 'id' ? selected.pointsId : selected.pointsEn).map((pt, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                  >
                    <span className="font-mono text-xs text-[#0078D4] dark:text-sky-400 mt-1 shrink-0 tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              {lang === 'id' ? 'Topik tidak ditemukan.' : 'No matching help topics.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
