import React, { useEffect, useState } from 'react';
import { Box, Flame, Layers, RefreshCw, Shield, Zap } from 'lucide-react';
import { api } from '../../api';
import { useT } from '../../i18n';
import { Lang, MempoolData } from '../../types';
import { formatBytes, formatTimeAgo, shortHash } from '../../utils';
import { FeeHistogramChart } from '../GlassCharts';

interface MempoolViewProps {
  lang: Lang;
  onInspectTx: (txid: string) => void;
}

export const MempoolView: React.FC<MempoolViewProps> = ({ lang, onInspectTx }) => {
  const t = useT(lang);
  const [data, setData] = useState<MempoolData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getMempool();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const preview = data?.next_block_preview;
  const fees = data?.fees;

  return (
    <div className="space-y-5">
      {/* Projected Next Block Card */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
            >
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('nextBlockPreview')}</h2>
              <p className="text-xs opacity-65 tabular-nums">
                {preview?.tx_count ?? 0} TXs · {((preview?.weight ?? 0) / 1e6).toFixed(2)} / 4.00 MWU ({preview?.source || '—'})
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="m3-glass-elevated m3-pill px-3.5 py-2 text-xs font-medium inline-flex items-center gap-1.5 hover:scale-105 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="h-4 rounded-full bg-white/10 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, Math.max(2, preview?.fill_pct ?? 0))}%`,
              background: 'linear-gradient(90deg, var(--m3-primary-strong), var(--m3-primary))',
            }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
          <div className="p-3.5 rounded-2xl bg-black/20">
            <div className="opacity-60">{t('blockFill')}</div>
            <div className="text-base font-bold mt-0.5">{preview?.fill_pct ?? 0}%</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/20">
            <div className="opacity-60">{t('estFees')}</div>
            <div className="text-base font-bold mt-0.5">{preview?.total_fees_ltc ?? 0} Ł</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/20">
            <div className="opacity-60">{t('feeRange')}</div>
            <div className="text-base font-bold mt-0.5">
              {preview?.fee_range_lit_vb?.[0] ?? 0} – {preview?.fee_range_lit_vb?.[1] ?? 0} lit/vB
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/20">
            <div className="opacity-60">{t('mempoolLoad')}</div>
            <div className="text-base font-bold mt-0.5">
              {(data?.stats.size ?? 0).toLocaleString()} TXs ({formatBytes(data?.stats.bytes)})
            </div>
          </div>
        </div>
      </div>

      {/* 4 Smart Fee Priority Cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold opacity-80 px-1">{t('feePriorityTitle')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('priorityNext'), val: fees?.next_block ?? 1, icon: <Flame className="w-4 h-4 text-amber-400" /> },
            { label: t('priorityHigh'), val: fees?.half_hour ?? 1, icon: <Zap className="w-4 h-4 text-emerald-400" /> },
            { label: t('priorityStd'), val: fees?.hour ?? 1, icon: <Layers className="w-4 h-4 text-blue-400" /> },
            { label: t('priorityEco'), val: fees?.economy ?? 1, icon: <Layers className="w-4 h-4 opacity-60" /> },
          ].map((card) => (
            <div key={card.label} className="m3-glass m3-card p-5 space-y-2">
              <div className="flex items-center justify-between text-xs opacity-75">
                <span>{card.label}</span>
                {card.icon}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {card.val} <span className="text-xs font-normal opacity-65">lit/vB</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee Histogram + Live Unconfirmed TXs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="m3-glass m3-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">{t('feeHistogram')}</h3>
            <span className="text-xs opacity-60">lit/vB</span>
          </div>
          {data?.histogram?.length ? (
            <FeeHistogramChart buckets={data.histogram} />
          ) : (
            <div className="h-44 flex items-center justify-center text-xs opacity-60">Mempool is currently empty</div>
          )}
        </div>

        <div className="m3-glass m3-card p-6 space-y-3">
          <h3 className="font-semibold text-base">{t('liveMempoolTxs')}</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(data?.recent_txs ?? []).length === 0 && (
              <div className="py-12 text-center text-xs opacity-60">No unconfirmed transactions yet</div>
            )}
            {(data?.recent_txs ?? []).map((tx) => (
              <button
                key={tx.txid}
                onClick={() => onInspectTx(tx.txid)}
                className="w-full m3-glass-elevated m3-card-interactive rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium truncate">{shortHash(tx.txid, 12, 8)}</span>
                    {tx.is_mweb && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> MWEB
                      </span>
                    )}
                  </div>
                  <div className="opacity-60 mt-0.5 tabular-nums">
                    {tx.vsize} vB · {formatTimeAgo(tx.time)}
                  </div>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <div className="font-semibold" style={{ color: 'var(--m3-primary)' }}>
                    {tx.feerate_lit_vb} lit/vB
                  </div>
                  {tx.amount_ltc !== undefined && <div className="opacity-65 text-[11px]">{tx.amount_ltc} Ł</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
