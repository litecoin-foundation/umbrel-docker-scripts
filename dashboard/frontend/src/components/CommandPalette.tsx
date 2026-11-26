import React, { useEffect, useState } from 'react';
import { ArrowRight, Blocks, Layers, Network, Search, Terminal, X } from 'lucide-react';
import { api } from '../api';
import { useT } from '../i18n';
import { Lang, NavTab } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  onNavigate: (tab: NavTab) => void;
  onInspectBlock: (id: string) => void;
  onInspectTx: (txid: string) => void;
  onScanAddress: (address: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  lang,
  onNavigate,
  onInspectBlock,
  onInspectTx,
  onScanAddress,
}) => {
  const t = useT(lang);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(q);
      onClose();
      if (res.kind === 'block') onInspectBlock(res.target);
      else if (res.kind === 'tx') onInspectTx(res.target);
      else if (res.kind === 'address') onScanAddress(res.target);
    } catch (err: any) {
      setError(err?.message || 'Not found');
    } finally {
      setLoading(false);
    }
  };

  const quickTabs: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: t('navOverview'), icon: <Layers className="w-4 h-4" /> },
    { id: 'mempool', label: t('navMempool'), icon: <Layers className="w-4 h-4" /> },
    { id: 'explorer', label: t('navExplorer'), icon: <Blocks className="w-4 h-4" /> },
    { id: 'network', label: t('navNetwork'), icon: <Network className="w-4 h-4" /> },
    { id: 'tools', label: t('navTools'), icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl m3-glass-elevated rounded-[28px] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSearch} className="flex items-center gap-3 border-b border-white/10 pb-3">
          <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--m3-primary)' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 m3-pill text-xs font-medium text-white flex items-center gap-1"
            style={{ background: 'var(--m3-primary-strong)' }}
          >
            <span>{loading ? '…' : 'Go'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </form>

        {error && <div className="text-xs text-rose-400 px-1">{error}</div>}

        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider opacity-50 px-2 pb-1">Quick Jump</div>
          {quickTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onNavigate(tab.id);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-white/10 text-sm transition"
            >
              <span className="flex items-center gap-2.5">
                <span style={{ color: 'var(--m3-primary)' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-40" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
