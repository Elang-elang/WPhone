import React from 'react';
import { Monitor, RotateCcw, Smartphone, Sun, Moon, Laptop } from 'lucide-react';
import {
  DeviceViewportMode,
  LanguagePreference,
  ResolvedLanguage,
  ThemePreference,
  WorkspaceSection,
} from '../types/wphone';
import { translations } from '../i18n/translations';
import { WPhoneIcon } from './WPhoneIcon';

interface TopBarProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onOpenHelper: () => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  viewportMode: DeviceViewportMode;
  onViewportChange: (mode: DeviceViewportMode) => void;
  themePref: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  langPref: LanguagePreference;
  onLangChange: (pref: LanguagePreference) => void;
  resolvedLang: ResolvedLanguage;
  onResetDemo: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSelectSection,
  onOpenHelper,
  onPrimaryAction,
  primaryActionLabel,
  viewportMode,
  onViewportChange,
  themePref,
  onThemeChange,
  langPref,
  onLangChange,
  resolvedLang,
  onResetDemo,
}) => {
  const t = translations[resolvedLang];

  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => onSelectSection('prototype')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4] rounded-md"
        >
          <WPhoneIcon variant="launcher" className="w-7 h-7" alt="WPhone Icon" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {t.brand}
          </span>
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {(
            [
              { id: 'prototype' as const, label: t.nav.prototype },
              { id: 'android' as const, label: t.nav.android },
              { id: 'docs' as const, label: t.nav.docs },
              { id: 'compatibility' as const, label: t.nav.compatibility },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeSection === item.id
                  ? 'border-[#0078D4] text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenHelper}
            className="py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {t.nav.helper}
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#0078D4] hover:bg-[#006CBE] text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0078D4]"
          >
            {primaryActionLabel}
          </button>
        </div>
      </header>

      {/* Mobile Nav Row */}
      <div className="md:hidden border-t border-slate-100 dark:border-slate-800/80 px-4 py-2 flex items-center gap-3 overflow-x-auto text-xs font-medium">
        {(
          [
            { id: 'prototype' as const, label: t.nav.prototype },
            { id: 'android' as const, label: t.nav.android },
            { id: 'docs' as const, label: t.nav.docs },
            { id: 'compatibility' as const, label: t.nav.compatibility },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectSection(item.id)}
            className={`whitespace-nowrap shrink-0 py-1 px-2 rounded-md ${
              activeSection === item.id
                ? 'bg-[#0078D4]/10 text-[#0078D4] dark:text-sky-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenHelper}
          className="whitespace-nowrap shrink-0 py-1 px-2 rounded-md text-slate-600 dark:text-slate-400"
        >
          {t.nav.helper}
        </button>
      </div>

      {/* Workspace Controls Toolbar (Below Header) */}
      <div className="border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {activeSection === 'prototype' ? (
              <>
                <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  {t.toolbar.viewportLabel}:
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => onViewportChange('mobile')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      viewportMode === 'mobile'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{t.toolbar.mobileFrame}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewportChange('expanded')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      viewportMode === 'expanded'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>{t.toolbar.expandedFrame}</span>
                  </button>
                </div>
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                WPhone Full-Stack Workspace & Android Source Studio
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Theme Selector */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => onThemeChange('auto')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  themePref === 'auto'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Laptop className="w-3 h-3" />
                <span>{t.toolbar.themeAuto}</span>
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  themePref === 'light'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>{t.toolbar.themeLight}</span>
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  themePref === 'dark'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>{t.toolbar.themeDark}</span>
              </button>
            </div>

            {/* Language Selector */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => onLangChange('auto')}
                className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  langPref === 'auto'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.toolbar.langAuto}
              </button>
              <button
                type="button"
                onClick={() => onLangChange('id')}
                className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  langPref === 'id'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.toolbar.langId}
              </button>
              <button
                type="button"
                onClick={() => onLangChange('en')}
                className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  langPref === 'en'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.toolbar.langEn}
              </button>
            </div>

            <button
              type="button"
              onClick={onResetDemo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.toolbar.resetDemo}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
