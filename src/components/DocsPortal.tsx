import React, { useMemo, useState } from 'react';
import { Download, FileCode, Search } from 'lucide-react';
import { ResolvedLanguage } from '../types/wphone';
import { ENGINEERING_DOCS } from '../data/docsData';
import { translations } from '../i18n/translations';

interface DocsPortalProps {
  lang: ResolvedLanguage;
}

const renderInline = (text: string) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[0.85em] text-[#0078D4] dark:text-sky-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const MarkdownContent: React.FC<{ markdown: string }> = ({ markdown }) => {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={`code-${i}`}
          className="my-4 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800"
        >
          {codeLines.join('\n')}
        </pre>
      );
      i++;
      continue;
    }

    // Markdown table
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim());
        const headers = parseRow(tableLines[0]);
        const bodyRows = tableLines.slice(2).map(parseRow);
        elements.push(
          <div key={`tbl-${i}`} className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2 mb-3"
        >
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2.5 pt-4 border-t border-slate-100 dark:border-slate-800"
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <div
          key={`bq-${i}`}
          className="my-3 p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-200"
        >
          {renderInline(line.slice(2))}
        </div>
      );
    } else if (/^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^[-*]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))
      ) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-3 space-y-1.5 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() !== '') {
      elements.push(
        <p key={`p-${i}`} className="my-2.5 text-sm sm:text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed max-w-[75ch]">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }

  return <div>{elements}</div>;
};

export const DocsPortal: React.FC<DocsPortalProps> = ({ lang }) => {
  const t = translations[lang].docs;
  const [selectedId, setSelectedId] = useState(ENGINEERING_DOCS[0].id);
  const [search, setSearch] = useState('');

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ENGINEERING_DOCS;
    return ENGINEERING_DOCS.filter((doc) => {
      const title = (lang === 'id' ? doc.titleId : doc.titleEn).toLowerCase();
      const body = (lang === 'id' ? doc.contentId : doc.contentEn).toLowerCase();
      return (
        doc.filename.toLowerCase().includes(q) || title.includes(q) || body.includes(q)
      );
    });
  }, [search, lang]);

  const activeDoc =
    filteredDocs.find((d) => d.id === selectedId) || filteredDocs[0] || ENGINEERING_DOCS[0];

  const handleDownloadMd = () => {
    const content = lang === 'id' ? activeDoc.contentId : activeDoc.contentEn;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeDoc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {t.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-[#0078D4] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar: 12 Mandatory Documents */}
        <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {filteredDocs.map((doc, idx) => {
            const active = activeDoc.id === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5 ${
                  active
                    ? 'bg-[#0078D4]/8 dark:bg-[#0078D4]/20 text-slate-900 dark:text-white'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="font-mono text-[11px] text-slate-400 mt-0.5 tabular-nums shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold text-[#0078D4] dark:text-sky-400 truncate">
                    {doc.filename}
                  </div>
                  <div className="text-xs font-medium mt-0.5 leading-snug">
                    {lang === 'id' ? doc.titleId : doc.titleEn}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Active Document Reader */}
        <article className="lg:col-span-8 xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FileCode className="w-3.5 h-3.5 text-[#0078D4]" />
                <span className="font-mono">{activeDoc.filename}</span>
                <span aria-hidden="true">·</span>
                <span>{activeDoc.phase}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {lang === 'id' ? activeDoc.summaryId : activeDoc.summaryEn}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadMd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadMd}</span>
            </button>
          </div>

          <MarkdownContent markdown={lang === 'id' ? activeDoc.contentId : activeDoc.contentEn} />
        </article>
      </div>
    </div>
  );
};
