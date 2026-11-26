import React, { useState } from 'react';
import {
  Activity,
  Check,
  Lock,
  Moon,
  Palette,
  Search,
  Shield,
  ShieldCheck,
  Sun,
  Unlock,
} from 'lucide-react';
import { useT } from '../i18n';
import { AccentSeed, Lang, OverviewData, PrivacySettings, ThemeMode } from '../types';

export const LitecoinLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ltcLogoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--m3-primary)" />
        <stop offset="100%" stopColor="var(--m3-primary-strong)" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#ltcLogoGrad)" />
    <path
      d="M27.3 42.5L29.7 33.4L25.5 34.9L26.5 31.1L30.7 29.6L34.7 14.5H43.1L39.7 27.3L43.9 25.8L42.9 29.6L38.7 31.1L36.7 38.6H48.2L46.9 43.5H27.3V42.5Z"
      fill="#ffffff"
    />
  </svg>
);

interface HeaderProps {
  overview: OverviewData | null;
  wsConnected: boolean;
  lang: Lang;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  accent: AccentSeed;
  onAccentChange: (a: AccentSeed) => void;
  privacy: PrivacySettings;
  onUpdatePrivacy: (patch: Partial<PrivacySettings>) => void;
  authenticated: boolean;
  onOpenAdminModal: () => void;
  onLogout: () => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  overview,
  wsConnected,
  lang,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  privacy,
  onUpdatePrivacy,
  authenticated,
  onOpenAdminModal,
  onLogout,
  onOpenSearch,
}) => {
  const t = useT(lang);
  const [openMenu, setOpenMenu] = useState<'privacy' | 'theme' | null>(null);

  const status = overview?.status ?? 'warming_up';
  const statusDot =
    status === 'synced'
      ? 'bg-emerald-400'
      : status === 'syncing'
        ? 'bg-amber-400'
        : status === 'warming_up'
          ? 'bg-sky-400'
          : 'bg-rose-400';

  const statusLabel =
    status === 'synced'
      ? t('statusSynced')
      : status === 'syncing'
        ? overview?.sync_stage === 'headers'
          ? `${t('statusSyncingHeaders')} ${overview?.header_progress ?? 0}%`
          : `${t('statusSyncing')} ${overview?.verification_progress ?? 0}%`
        : status === 'warming_up'
          ? t('statusWarming')
          : t('statusOffline');

  const externalActive = privacy.enable_price_ticker || privacy.enable_geoip;
  const accents: Array<{ id: AccentSeed; label: string; color: string }> = [
    { id: 'cobalt', label: 'Litecoin Cobalt', color: '#60a5fa' },
    { id: 'silver', label: 'Silver Glass', color: '#cbd5e1' },
    { id: 'mweb', label: 'MWEB Emerald', color: '#34d399' },
    { id: 'violet', label: 'Amethyst', color: '#a78bfa' },
  ];

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 pb-2">
      <div className="max-w-[1440px] mx-auto m3-glass rounded-[24px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand + Status Pill */}
        <div className="flex items-center gap-3">
          <LitecoinLogo className="w-9 h-9 shrink-0 shadow-lg rounded-full" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-base">{t('appTitle')}</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 m3-pill text-xs font-medium"
                style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
              >
                <span className={`w-2 h-2 rounded-full ${statusDot} animate-pulse`} />
                <span className="tabular-nums">{statusLabel}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] opacity-70">
              <span>{overview?.subversion || t('appSubtitle')}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3 h-3" style={{ color: wsConnected ? '#34d399' : '#94a3b8' }} />
                {wsConnected ? t('wsLive') : t('wsConnecting')}
              </span>
            </div>
          </div>
        </div>

        {/* Global Search Pill */}
        <button
          onClick={onOpenSearch}
          className="flex-1 min-w-[200px] max-w-md m3-glass-elevated m3-pill px-4 py-2 flex items-center justify-between gap-2 text-xs opacity-85 hover:opacity-100 transition"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--m3-primary)' }} />
            <span className="truncate opacity-75">{t('searchPlaceholder')}</span>
          </span>
          <kbd className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-white/15 opacity-75">
            ⌘K
          </kbd>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2 relative">
          {/* Privacy Shield Popover */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'privacy' ? null : 'privacy')}
              className="m3-glass-elevated m3-pill p-2 hover:scale-105 transition"
              title={t('privacyShield')}
            >
              {externalActive ? (
                <Shield className="w-4 h-4 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            {openMenu === 'privacy' && (
              <div className="absolute right-0 mt-2 w-72 m3-glass-elevated rounded-[24px] p-4 z-50 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{t('privacyShield')}</span>
                  <span
                    className={`px-2 py-0.5 m3-pill text-[10px] font-medium ${
                      externalActive ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {externalActive ? t('externalActive') : t('zeroExternal')}
                  </span>
                </div>
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span>{t('enablePriceTicker')}</span>
                  <input
                    type="checkbox"
                    checked={privacy.enable_price_ticker}
                    onChange={(e) => onUpdatePrivacy({ enable_price_ticker: e.target.checked })}
                    className="accent-blue-500 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span>{t('enableGeoIp')}</span>
                  <input
                    type="checkbox"
                    checked={privacy.enable_geoip}
                    onChange={(e) => onUpdatePrivacy({ enable_geoip: e.target.checked })}
                    className="accent-blue-500 w-4 h-4"
                  />
                </label>
                <p className="text-[11px] opacity-65 leading-relaxed">{t('privacyHint')}</p>
              </div>
            )}
          </div>

          {/* Theme & M3 Accent Popover */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'theme' ? null : 'theme')}
              className="m3-glass-elevated m3-pill p-2 hover:scale-105 transition"
              title={t('themeAppearance')}
            >
              <Palette className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            </button>
            {openMenu === 'theme' && (
              <div className="absolute right-0 mt-2 w-64 m3-glass-elevated rounded-[24px] p-4 z-50 space-y-3 text-xs">
                <div className="font-semibold text-sm">{t('themeAppearance')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-2xl border ${
                      theme === 'dark' ? 'border-blue-400/60 bg-blue-500/15' : 'border-white/10 opacity-70'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" /> {t('darkGlass')}
                  </button>
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-2xl border ${
                      theme === 'light' ? 'border-blue-500/60 bg-blue-500/15' : 'border-white/10 opacity-70'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" /> {t('lightGlass')}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {accents.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onAccentChange(item.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-white/5 transition"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ background: item.color }} />
                        <span>{item.label}</span>
                      </span>
                      {accent === item.id && <Check className="w-3.5 h-3.5" style={{ color: item.color }} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Admin Smart-Auth Pill */}
          {authenticated ? (
            <button
              onClick={onLogout}
              className="m3-pill px-3 py-2 text-xs font-medium flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 transition"
              title={t('adminLock')}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('adminUnlocked')}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAdminModal}
              className="m3-glass-elevated m3-pill px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:scale-105 transition"
            >
              <Lock className="w-3.5 h-3.5 opacity-80" />
              <span className="hidden sm:inline">{t('adminUnlock')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
