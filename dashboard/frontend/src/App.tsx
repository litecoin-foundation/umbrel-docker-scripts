import React, { useCallback, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from './api';
import { AdminModal } from './components/AdminModal';
import { CommandPalette } from './components/CommandPalette';
import { DetailDrawers } from './components/DetailDrawers';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ExplorerView } from './components/views/ExplorerView';
import { MempoolView } from './components/views/MempoolView';
import { NetworkView } from './components/views/NetworkView';
import { OverviewView } from './components/views/OverviewView';
import { ToolsView } from './components/views/ToolsView';
import {
  AccentSeed,
  AuthStatus,
  ChartBlockPoint,
  Lang,
  MarketPrice,
  NavTab,
  OverviewData,
  PrivacySettings,
  ThemeMode,
} from './types';

export function App() {
  const [tab, setTab] = useState<NavTab>('overview');
  const lang: Lang = 'en';
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [accent, setAccent] = useState<AccentSeed>('cobalt');

  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    lock_entire_dashboard: false,
    admin_configured: true,
  });
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [chartBlocks, setChartBlocks] = useState<ChartBlockPoint[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [blockFlash, setBlockFlash] = useState(false);

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    enable_price_ticker: false,
    enable_geoip: false,
    external_proxy: null,
  });
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null);

  const [inspectBlockId, setInspectBlockId] = useState<string | null>(null);
  const [inspectTxId, setInspectTxId] = useState<string | null>(null);
  const [inspectTxBlockHash, setInspectTxBlockHash] = useState<string | null>(null);
  const [scanAddressTarget, setScanAddressTarget] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, [theme, accent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const a = await api.authStatus();
      setAuthStatus(a);
      if (a.lock_entire_dashboard && !a.authenticated) {
        return;
      }
      const p = await api.getPrivacySettings();
      setPrivacy(p);
    } catch {
      // ignore initial error
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const fetchOverviewAndChart = useCallback(async () => {
    if (authStatus.lock_entire_dashboard && !authStatus.authenticated) return;
    try {
      const [ov, ch] = await Promise.all([api.getOverview(), api.getChartBlocks(60)]);
      setOverview(ov);
      setChartBlocks(ch.blocks);
    } catch {
      // keep previous view cleanly
    }
  }, [authStatus.lock_entire_dashboard, authStatus.authenticated]);

  useEffect(() => {
    fetchOverviewAndChart();
    const id = setInterval(fetchOverviewAndChart, 10000);
    return () => clearInterval(id);
  }, [fetchOverviewAndChart]);

  useEffect(() => {
    if (!privacy.enable_price_ticker) {
      setMarketPrice(null);
      return;
    }
    api.getMarketPrice().then(setMarketPrice).catch(() => {});
    const id = setInterval(() => {
      api.getMarketPrice().then(setMarketPrice).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [privacy.enable_price_ticker]);

  useEffect(() => {
    if (authStatus.lock_entire_dashboard && !authStatus.authenticated) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = getStoredToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/live${qs}`);

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'telemetry' && msg.data) {
          setOverview(msg.data);
        } else if (msg.type === 'new_block') {
          setBlockFlash(true);
          setTimeout(() => setBlockFlash(false), 1800);
          fetchOverviewAndChart();
        }
      } catch {
        // ignore parse errors
      }
    };
    return () => ws.close();
  }, [authStatus.lock_entire_dashboard, authStatus.authenticated, fetchOverviewAndChart]);

  const handleUpdatePrivacy = async (patch: Partial<PrivacySettings>) => {
    const next = await api.updatePrivacySettings(patch);
    setPrivacy(next);
  };

  const openTx = (txid: string, blockhash?: string | null) => {
    setInspectTxBlockHash(blockhash ?? null);
    setInspectTxId(txid);
  };

  const fullLocked = authStatus.lock_entire_dashboard && !authStatus.authenticated;

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-20 lg:pb-10">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-[120px] animate-float-slow"
          style={{ background: 'var(--m3-blob-1)' }}
        />
        <div
          className="absolute top-1/3 -right-32 w-[460px] h-[460px] rounded-full blur-[130px] animate-float-slow"
          style={{ background: 'var(--m3-blob-2)', animationDelay: '-6s' }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] animate-float-slow"
          style={{ background: 'var(--m3-blob-3)', animationDelay: '-11s' }}
        />
      </div>

      <Header
        overview={overview}
        wsConnected={wsConnected}
        lang={lang}
        theme={theme}
        onThemeChange={setTheme}
        accent={accent}
        onAccentChange={setAccent}
        privacy={privacy}
        onUpdatePrivacy={handleUpdatePrivacy}
        authenticated={authStatus.authenticated}
        onOpenAdminModal={() => setAdminModalOpen(true)}
        onLogout={() => {
          setStoredToken(null);
          setAuthStatus((s) => ({ ...s, authenticated: false }));
        }}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {!fullLocked && (
        <div className="max-w-[1440px] mx-auto px-4 pt-3 flex gap-5">
          <Navigation active={tab} onChange={setTab} lang={lang} />
          <main className="flex-1 min-w-0">
            {tab === 'overview' && (
              <OverviewView
                overview={overview}
                chartBlocks={chartBlocks}
                marketPrice={marketPrice}
                blockFlash={blockFlash}
                lang={lang}
                onNavigate={setTab}
                onInspectBlock={(id) => setInspectBlockId(id)}
              />
            )}
            {tab === 'mempool' && <MempoolView lang={lang} onInspectTx={(txid) => openTx(txid)} />}
            {tab === 'explorer' && (
              <ExplorerView
                lang={lang}
                initialAddress={scanAddressTarget}
                onInspectBlock={(id) => setInspectBlockId(id)}
                onInspectTx={(txid) => openTx(txid)}
              />
            )}
            {tab === 'network' && (
              <NetworkView
                lang={lang}
                authenticated={authStatus.authenticated}
                onRequireAuth={() => setAdminModalOpen(true)}
              />
            )}
            {tab === 'tools' && (
              <ToolsView
                lang={lang}
                authenticated={authStatus.authenticated}
                onRequireAuth={() => setAdminModalOpen(true)}
              />
            )}
          </main>
        </div>
      )}

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        lang={lang}
        onNavigate={setTab}
        onInspectBlock={(id) => setInspectBlockId(id)}
        onInspectTx={(txid) => openTx(txid)}
        onScanAddress={(addr) => {
          setScanAddressTarget(addr);
          setTab('explorer');
        }}
      />

      <DetailDrawers
        blockId={inspectBlockId}
        txid={inspectTxId}
        txBlockHash={inspectTxBlockHash}
        lang={lang}
        onCloseBlock={() => setInspectBlockId(null)}
        onCloseTx={() => {
          setInspectTxId(null);
          setInspectTxBlockHash(null);
        }}
        onOpenTx={openTx}
        onOpenBlock={(id) => setInspectBlockId(id)}
      />

      <AdminModal
        open={adminModalOpen || fullLocked}
        fullLock={fullLocked}
        lang={lang}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={(token) => {
          setStoredToken(token);
          setAuthStatus((s) => ({ ...s, authenticated: true }));
          setAdminModalOpen(false);
          bootstrap();
        }}
      />
    </div>
  );
}

export default App;
