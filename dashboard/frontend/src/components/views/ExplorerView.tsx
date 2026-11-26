import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Shield, Wallet } from 'lucide-react';
import { api } from '../../api';
import { useT } from '../../i18n';
import { BlockSummary, Lang } from '../../types';
import { formatBytes, formatTimeAgo, shortHash } from '../../utils';

interface ExplorerViewProps {
  lang: Lang;
  initialAddress?: string | null;
  onInspectBlock: (id: string) => void;
  onInspectTx: (txid: string) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  lang,
  initialAddress,
  onInspectBlock,
  onInspectTx,
}) => {
  const t = useT(lang);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [tipHeight, setTipHeight] = useState(0);
  const [startHeight, setStartHeight] = useState<number | undefined>(undefined);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [address, setAddress] = useState(initialAddress || '');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingBlocks(true);
    api
      .getBlocks(15, startHeight)
      .then((res) => {
        setBlocks(res.blocks);
        setTipHeight(res.tip_height);
      })
      .finally(() => setLoadingBlocks(false));
  }, [startHeight]);

  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
      runScan(initialAddress);
    }
  }, [initialAddress]);

  const runScan = async (addrToScan?: string) => {
    const target = (addrToScan ?? address).trim();
    if (!target) return;
    setScanning(true);
    setScanError(null);
    try {
      const res = await api.scanAddress(target);
      setScanResult(res);
    } catch (e: any) {
      setScanError(e.message);
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Address UTXO Balance Scanner */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
          >
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">{t('utxoScannerTitle')}</h2>
            <p className="text-xs opacity-65 mt-0.5">{t('utxoScannerDesc')}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runScan();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ltc1q... / M... / L..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-black/25 border border-white/15 outline-none focus:border-blue-400 text-xs font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={scanning || !address.trim()}
            className="m3-pill px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--m3-primary-strong)' }}
          >
            {scanning ? t('scanning') : t('scanBtn')}
          </button>
        </form>

        {scanError && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300">{scanError}</div>
        )}

        {scanResult && (
          <div className="space-y-3 pt-1">
            <div className="m3-glass-elevated rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs opacity-65">{t('totalBalance')}</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--m3-primary)' }}>
                  {scanResult.total_amount_ltc} Ł
                </div>
              </div>
              <div className="text-right text-xs tabular-nums opacity-75">
                <div>{scanResult.utxo_count} UTXOs</div>
                <div>Height #{Number(scanResult.height || 0).toLocaleString()}</div>
              </div>
            </div>

            {(scanResult.utxos ?? []).length > 0 && (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {scanResult.utxos.map((u: any) => (
                  <button
                    key={`${u.txid}-${u.vout}`}
                    onClick={() => onInspectTx(u.txid)}
                    className="w-full m3-glass-elevated m3-card-interactive rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-left"
                  >
                    <span className="font-mono truncate">
                      {shortHash(u.txid, 12, 8)}:{u.vout}
                    </span>
                    <span className="tabular-nums font-semibold shrink-0">
                      {u.amount} Ł <span className="opacity-60 font-normal">({u.confirmations} conf)</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Explorer Table */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{t('blocksTableTitle')}</h3>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setStartHeight(undefined)}
              disabled={startHeight === undefined}
              className="m3-glass-elevated m3-pill px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('newer')}
            </button>
            <button
              onClick={() => {
                const last = blocks[blocks.length - 1];
                if (last && last.height > 0) setStartHeight(last.height - 1);
              }}
              disabled={!blocks.length || blocks[blocks.length - 1]?.height <= 0}
              className="m3-glass-elevated m3-pill px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-40"
            >
              {t('older')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="py-2.5 pr-4">{t('height')}</th>
                <th className="py-2.5 pr-4">Hash</th>
                <th className="py-2.5 pr-4">{t('txs')}</th>
                <th className="py-2.5 pr-4">MWEB</th>
                <th className="py-2.5 pr-4">{t('miner')}</th>
                <th className="py-2.5 pr-4">{t('size')}</th>
                <th className="py-2.5 text-right">{t('age')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 tabular-nums">
              {loadingBlocks && !blocks.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center opacity-60">
                    Loading blocks…
                  </td>
                </tr>
              )}
              {blocks.map((b) => (
                <tr
                  key={b.hash || b.height}
                  onClick={() => onInspectBlock(String(b.height))}
                  className="hover:bg-white/5 cursor-pointer transition"
                >
                  <td className="py-3 pr-4 font-semibold" style={{ color: 'var(--m3-primary)' }}>
                    #{b.height.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 font-mono opacity-80">{shortHash(b.hash, 10, 8)}</td>
                  <td className="py-3 pr-4">{b.tx_count}</td>
                  <td className="py-3 pr-4">
                    {b.has_mweb ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> {b.mweb_kernels ?? 0}k
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 opacity-80">{b.miner || '—'}</td>
                  <td className="py-3 pr-4">{formatBytes(b.size, 1)}</td>
                  <td className="py-3 text-right opacity-70">{formatTimeAgo(b.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tipHeight > 0 && (
          <div className="text-[11px] opacity-55 tabular-nums">Chain tip: #{tipHeight.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
};
