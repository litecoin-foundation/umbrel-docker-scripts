import React, { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Cpu,
  Database,
  Flame,
  HardDrive,
  Layers,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useT } from '../../i18n';
import { ChartBlockPoint, Lang, MarketPrice, NavTab, OverviewData } from '../../types';
import { formatBytes, formatDuration, formatHashrate, formatTimeAgo, shortHash } from '../../utils';
import { GlassAreaChart } from '../GlassCharts';

interface OverviewViewProps {
  overview: OverviewData | null;
  chartBlocks: ChartBlockPoint[];
  marketPrice: MarketPrice | null;
  blockFlash: boolean;
  lang: Lang;
  onNavigate: (tab: NavTab) => void;
  onInspectBlock: (id: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  overview,
  chartBlocks,
  marketPrice,
  blockFlash,
  lang,
  onNavigate,
  onInspectBlock,
}) => {
  const t = useT(lang);
  const [chartMetric, setChartMetric] = useState<'tx_count' | 'size_kb' | 'interval_s'>('tx_count');

  const isSyncingOrCold =
    overview && (overview.initial_block_download || overview.status === 'warming_up' || overview.status === 'offline');
  const isHeadersStage = overview?.sync_stage === 'headers';

  const chartPoints = chartBlocks.map((b) => ({
    label: `#${b.height.toLocaleString()}`,
    value: chartMetric === 'tx_count' ? b.tx_count : chartMetric === 'size_kb' ? b.size_kb : b.interval_s,
  }));

  const halving = overview?.halving;
  const estHalvingDate = halving?.estimated_timestamp
    ? new Date(halving.estimated_timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const targetTip = Math.max(overview?.headers ?? 0, overview?.network_tip ?? 0);
  const progressPct = isHeadersStage
    ? (overview?.header_progress ?? 0)
    : (overview?.verification_progress ?? 0);

  return (
    <div className="space-y-5">
      {/* 2-Stage Live IBD / Syncing Hero Banner */}
      {isSyncingOrCold && (
        <div className="m3-glass m3-card p-5 sm:p-6 border border-amber-400/25">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles className="w-4 h-4" />
                {overview.status === 'warming_up' || overview.status === 'offline'
                  ? overview.status_message
                  : isHeadersStage
                    ? t('headersSyncTitle')
                    : t('ibdTitle')}
              </div>
              <p className="text-sm opacity-80 max-w-3xl">
                {isHeadersStage ? t('headersSyncDesc') : t('ibdDesc')}
              </p>
            </div>
            <div className="m3-glass-elevated m3-pill px-4 py-2 text-xs font-semibold tabular-nums shrink-0 self-start md:self-center">
              {progressPct}%
            </div>
          </div>
          {(overview.headers > 0 || targetTip > 0) && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap justify-between text-xs tabular-nums opacity-85 gap-2">
                {isHeadersStage ? (
                  <span>
                    {overview.headers.toLocaleString()} / {targetTip.toLocaleString()} headers ({overview.header_progress ?? 0}%)
                  </span>
                ) : (
                  <span>
                    {overview.blocks.toLocaleString()} / {targetTip.toLocaleString()} blocks ({overview.verification_progress}%)
                  </span>
                )}
                <span>
                  {isHeadersStage
                    ? overview.headers_per_sec
                      ? `${overview.headers_per_sec.toLocaleString()} hdr/s · `
                      : ''
                    : overview.sync_speed_bps
                      ? `${overview.sync_speed_bps} blk/s · `
                      : ''}
                  ETA {formatDuration(overview.sync_eta_seconds)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(2, Math.min(100, progressPct))}%`,
                    background: 'linear-gradient(90deg, var(--m3-primary-strong), var(--m3-primary))',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`m3-glass m3-card p-5 ${blockFlash ? 'animate-block-flash' : ''}`}>
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>{t('blockHeight')}</span>
            <Database className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
          </div>
          <div className="text-3xl font-bold tracking-tight tabular-nums mt-2">
            {(overview?.blocks ?? 0).toLocaleString()}
          </div>
          <div className="text-xs opacity-70 mt-2 flex justify-between tabular-nums">
            <span>
              {t('headers')}: {(overview?.headers ?? 0).toLocaleString()}
              {overview?.network_tip && overview.network_tip > overview.headers
                ? ` / ${overview.network_tip.toLocaleString()}`
                : ''}
            </span>
            <span>{progressPct}%</span>
          </div>
        </div>

        <div className="m3-glass m3-card p-5">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>{t('networkHashrate')}</span>
            <Cpu className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
          </div>
          <div className="text-3xl font-bold tracking-tight tabular-nums mt-2">
            {formatHashrate(overview?.network_hashrate_hs)}
          </div>
          <div className="text-xs opacity-70 mt-2 tabular-nums">
            {t('difficulty')}: {(overview?.difficulty ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="m3-glass m3-card p-5">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>{t('mempoolLoad')}</span>
            <Layers className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
          </div>
          <div className="text-3xl font-bold tracking-tight tabular-nums mt-2">
            {(overview?.mempool_tx_count ?? 0).toLocaleString()} <span className="text-base font-normal opacity-65">TXs</span>
          </div>
          <div className="text-xs opacity-70 mt-2 flex justify-between tabular-nums">
            <span>{formatBytes(overview?.mempool_bytes)}</span>
            <span className="font-medium" style={{ color: 'var(--m3-primary)' }}>
              {t('fastestFee')}: {overview?.fastest_fee_lit_vb ?? 1} lit/vB
            </span>
          </div>
        </div>

        <div className="m3-glass m3-card p-5">
          <div className="flex items-center justify-between text-xs opacity-70">
            <span>{t('connectionsStorage')}</span>
            <HardDrive className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
          </div>
          <div className="text-3xl font-bold tracking-tight tabular-nums mt-2">
            {overview?.connections ?? 0} <span className="text-base font-normal opacity-65">Peers</span>
          </div>
          <div className="text-xs opacity-70 mt-2 flex justify-between tabular-nums">
            <span>{formatBytes(overview?.size_on_disk_bytes, 1)}</span>
            <span>{overview?.pruned ? t('pruned') : t('archival')}</span>
          </div>
        </div>
      </div>

      {/* Optional Opt-in Market Price Strip */}
      {marketPrice?.enabled && (
        <div className="m3-glass m3-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Activity className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            <span>{t('ltcPrice')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 tabular-nums">
            <span>
              <span className="opacity-65 text-xs mr-1.5">USD</span>
              <span className="font-bold">${marketPrice.usd?.toFixed(2) ?? '—'}</span>
            </span>
            <span>
              <span className="opacity-65 text-xs mr-1.5">EUR</span>
              <span className="font-bold">€{marketPrice.eur?.toFixed(2) ?? '—'}</span>
            </span>
            {marketPrice.change_24h !== null && (
              <span className={`font-semibold text-xs px-2.5 py-0.5 m3-pill ${marketPrice.change_24h >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {marketPrice.change_24h >= 0 ? '+' : ''}
                {marketPrice.change_24h}% (24h)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Halving Countdown + MWEB & Softforks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="m3-glass m3-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
              >
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{t('halvingCountdown')}</h3>
                <p className="text-xs opacity-65 tabular-nums">
                  {t('halvingTarget')}: #{(halving?.next_halving_height ?? 3360000).toLocaleString()}
                </p>
              </div>
            </div>
            <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--m3-primary)' }}>
              {halving?.progress_pct ?? 0}%
            </span>
          </div>

          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(2, halving?.progress_pct ?? 0))}%`,
                background: 'linear-gradient(90deg, var(--m3-primary-strong), var(--m3-primary))',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs tabular-nums pt-1">
            <div className="p-3 rounded-2xl bg-black/20">
              <div className="opacity-60">{t('blocksLeft')}</div>
              <div className="font-semibold text-sm mt-0.5">{(halving?.remaining_blocks ?? 0).toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-2xl bg-black/20">
              <div className="opacity-60">{t('rewardDrop')}</div>
              <div className="font-semibold text-sm mt-0.5">
                {halving?.current_subsidy_ltc ?? 6.25} → {halving?.next_subsidy_ltc ?? 3.125} Ł
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-black/20">
              <div className="opacity-60">{t('estDate')}</div>
              <div className="font-semibold text-sm mt-0.5">{estHalvingDate}</div>
            </div>
          </div>
        </div>

        <div className="m3-glass m3-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-300">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{t('mwebStatus')}</h3>
                <p className="text-xs opacity-65">{t('mwebDesc')}</p>
              </div>
            </div>
            <span
              className={`px-3 py-1 m3-pill text-xs font-semibold ${
                overview?.mweb?.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 opacity-70'
              }`}
            >
              {overview?.mweb?.active ? 'MWEB Active' : 'Pending Sync'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-2xl bg-black/20">
              <div className="opacity-60">{t('peggedIn')}</div>
              <div className="font-semibold text-sm mt-0.5">
                {overview?.mweb?.pegged_in_estimate_ltc
                  ? `${overview.mweb.pegged_in_estimate_ltc.toLocaleString()} Ł`
                  : overview?.mweb?.hogex_enabled
                    ? 'HogEx Ready'
                    : '—'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-black/20">
              <div className="opacity-60">{t('latestKernels')}</div>
              <div className="font-semibold text-sm mt-0.5">{overview?.mweb?.recent_kernels ?? 0}</div>
            </div>
            <div className="p-3 rounded-2xl bg-black/20 col-span-2 sm:col-span-1">
              <div className="opacity-60">{t('uptime')}</div>
              <div className="font-semibold text-sm mt-0.5 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 opacity-70" />
                {formatDuration(overview?.uptime_seconds)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(overview?.softforks ?? []).slice(0, 7).map((sf) => (
              <span
                key={sf.name}
                className={`px-3 py-1 m3-pill text-xs font-medium border ${
                  sf.active
                    ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300'
                    : 'bg-white/5 border-white/10 opacity-65'
                }`}
              >
                {sf.name.toUpperCase()} {sf.active ? '✓' : sf.status ? `(${sf.status})` : '…'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Chart + Recent Blocks Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 m3-glass m3-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-base">{t('recentMetrics')}</h3>
            <div className="m3-glass-elevated m3-pill p-1 flex items-center text-xs">
              {(
                [
                  { id: 'tx_count', label: t('metricTxs') },
                  { id: 'size_kb', label: t('metricSize') },
                  { id: 'interval_s', label: t('metricInterval') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartMetric(tab.id)}
                  className={`px-3 py-1 m3-pill transition ${
                    chartMetric === tab.id ? 'text-white font-medium' : 'opacity-65 hover:opacity-100'
                  }`}
                  style={chartMetric === tab.id ? { background: 'var(--m3-primary-strong)' } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <GlassAreaChart
            points={chartPoints}
            unit={chartMetric === 'tx_count' ? 'TXs' : chartMetric === 'size_kb' ? 'KB' : 's'}
          />
        </div>

        <div className="m3-glass m3-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">{t('recentBlocks')}</h3>
            <button
              onClick={() => onNavigate('explorer')}
              className="text-xs font-medium inline-flex items-center gap-1 hover:underline"
              style={{ color: 'var(--m3-primary)' }}
            >
              {t('viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {(overview?.recent_blocks ?? []).length === 0 && (
              <div className="py-10 text-center text-xs opacity-60">Waiting for blocks…</div>
            )}
            {(overview?.recent_blocks ?? []).map((b) => (
              <button
                key={b.hash || b.height}
                onClick={() => onInspectBlock(String(b.height))}
                className="w-full m3-glass-elevated m3-card-interactive rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold tabular-nums">
                    <span style={{ color: 'var(--m3-primary)' }}>#{b.height.toLocaleString()}</span>
                    {b.has_mweb && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
                        MWEB
                      </span>
                    )}
                    {b.miner && <span className="opacity-65 font-normal truncate">{b.miner}</span>}
                  </div>
                  <div className="font-mono text-[11px] opacity-55 mt-0.5">{shortHash(b.hash, 10, 6)}</div>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <div className="font-medium">{b.tx_count} TXs</div>
                  <div className="opacity-60 text-[11px]">{formatTimeAgo(b.time)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
