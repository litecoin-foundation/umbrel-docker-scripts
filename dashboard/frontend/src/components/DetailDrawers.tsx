import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Shield, X } from 'lucide-react';
import { api } from '../api';
import { useT } from '../i18n';
import { Lang } from '../types';
import { copyToClipboard, formatBytes, formatTimeAgo, shortHash } from '../utils';

interface DrawerProps {
  blockId: string | null;
  txid: string | null;
  txBlockHash?: string | null;
  lang: Lang;
  onCloseBlock: () => void;
  onCloseTx: () => void;
  onOpenTx: (txid: string, blockhash?: string | null) => void;
  onOpenBlock: (id: string) => void;
}

export const DetailDrawers: React.FC<DrawerProps> = ({
  blockId,
  txid,
  txBlockHash,
  lang,
  onCloseBlock,
  onCloseTx,
  onOpenTx,
  onOpenBlock,
}) => {
  const t = useT(lang);
  const [blockData, setBlockData] = useState<any>(null);
  const [txData, setTxData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!blockId) {
      setBlockData(null);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getBlockDetail(blockId)
      .then((res) => setBlockData(res.block))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [blockId]);

  useEffect(() => {
    if (!txid) {
      setTxData(null);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getTxDetail(txid, txBlockHash)
      .then((res) => setTxData(res.tx))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [txid, txBlockHash]);

  const handleCopy = async (key: string, val: string) => {
    if (await copyToClipboard(val)) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  if (!blockId && !txid) return null;

  const isTx = Boolean(txid);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
      onClick={isTx ? onCloseTx : onCloseBlock}
    >
      <div
        className="w-full max-w-2xl h-full overflow-y-auto m3-glass-elevated rounded-l-[28px] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-60">
              {isTx ? t('txInspector') : t('blockInspector')}
            </div>
            <h2 className="text-xl font-semibold tabular-nums mt-0.5">
              {isTx ? shortHash(txid, 12, 12) : blockData ? `#${Number(blockData.height).toLocaleString()}` : blockId}
            </h2>
          </div>
          <button
            onClick={isTx ? onCloseTx : onCloseBlock}
            className="p-2 m3-glass m3-pill hover:scale-105 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && <div className="py-12 text-center text-sm opacity-70">Loading…</div>}
        {err && <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-sm text-rose-300">{err}</div>}

        {!loading && !err && !isTx && blockData && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {blockData.miner && (
                <span className="px-3 py-1 m3-pill text-xs font-medium bg-blue-500/20 text-blue-300">
                  {blockData.miner}
                </span>
              )}
              {blockData.has_mweb && (
                <span className="px-3 py-1 m3-pill text-xs font-medium bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> MWEB ({blockData.mweb_kernels} kernels)
                </span>
              )}
              <span className="px-3 py-1 m3-pill text-xs bg-white/10 tabular-nums">
                {blockData.confirmations?.toLocaleString()} {t('confirmations')}
              </span>
            </div>

            <div className="m3-glass rounded-[22px] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-65">Hash</span>
                <button
                  onClick={() => handleCopy('bhash', blockData.hash)}
                  className="font-mono flex items-center gap-1.5 hover:text-blue-400 transition truncate"
                >
                  <span className="truncate">{blockData.hash}</span>
                  {copiedKey === 'bhash' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 tabular-nums">
                <div>
                  <div className="opacity-60">{t('txs')}</div>
                  <div className="font-semibold text-sm">{blockData.tx_count?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="opacity-60">{t('size')}</div>
                  <div className="font-semibold text-sm">{formatBytes(blockData.size)}</div>
                </div>
                <div>
                  <div className="opacity-60">Weight</div>
                  <div className="font-semibold text-sm">{(blockData.weight / 1e6).toFixed(2)} MWU</div>
                </div>
                <div>
                  <div className="opacity-60">{t('age')}</div>
                  <div className="font-semibold text-sm">{formatTimeAgo(blockData.time)}</div>
                </div>
              </div>
              {blockData.coinbase_tag && (
                <div className="pt-2 border-t border-white/10 flex justify-between gap-2">
                  <span className="opacity-60">Coinbase Tag</span>
                  <span className="font-mono text-emerald-300 truncate">{blockData.coinbase_tag}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-65">
                Transactions ({blockData.txs?.length ?? 0} shown)
              </div>
              <div className="space-y-2">
                {(blockData.txs ?? []).map((tx: any) => (
                  <button
                    key={tx.txid}
                    onClick={() => onOpenTx(tx.txid, blockData.hash)}
                    className="w-full m3-glass m3-card-interactive rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-medium truncate">{shortHash(tx.txid, 12, 10)}</div>
                      <div className="flex items-center gap-2 mt-1 opacity-70">
                        {tx.is_coinbase && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Coinbase</span>}
                        {tx.is_hogex && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">MWEB HogEx</span>}
                        <span>{tx.vin_count} in → {tx.vout_count} out</span>
                      </div>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <div className="font-semibold">{tx.total_out_ltc} Ł</div>
                      <div className="opacity-60">{tx.vsize} vB</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && !err && isTx && txData && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {txData.is_mweb && (
                <span className="px-3 py-1 m3-pill text-xs font-medium bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> MWEB
                </span>
              )}
              <span className="px-3 py-1 m3-pill text-xs bg-white/10 tabular-nums">
                {txData.confirmations > 0 ? `${txData.confirmations.toLocaleString()} ${t('confirmations')}` : 'Unconfirmed (Mempool)'}
              </span>
              {txData.blockheight !== null && txData.blockheight !== undefined && (
                <button
                  onClick={() => {
                    onCloseTx();
                    onOpenBlock(String(txData.blockheight));
                  }}
                  className="px-3 py-1 m3-pill text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 tabular-nums"
                >
                  Block #{Number(txData.blockheight).toLocaleString()}
                </button>
              )}
            </div>

            <div className="m3-glass rounded-[22px] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-60">TXID</span>
                <button
                  onClick={() => handleCopy('txid', txData.txid)}
                  className="font-mono flex items-center gap-1.5 hover:text-blue-400 truncate"
                >
                  <span className="truncate">{txData.txid}</span>
                  {copiedKey === 'txid' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 tabular-nums">
                <div>
                  <div className="opacity-60">vSize</div>
                  <div className="font-semibold text-sm">{txData.vsize} vB</div>
                </div>
                <div>
                  <div className="opacity-60">Weight</div>
                  <div className="font-semibold text-sm">{txData.weight} WU</div>
                </div>
                <div>
                  <div className="opacity-60">Fee</div>
                  <div className="font-semibold text-sm">{txData.fee_ltc !== null ? `${txData.fee_ltc} Ł` : '—'}</div>
                </div>
                <div>
                  <div className="opacity-60">Rate</div>
                  <div className="font-semibold text-sm">{txData.feerate_lit_vb !== null ? `${txData.feerate_lit_vb} lit/vB` : '—'}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="m3-glass rounded-[22px] p-4 space-y-2">
                <div className="font-semibold opacity-75">{t('inputs')} ({txData.vin?.length ?? 0})</div>
                {(txData.vin ?? []).map((v: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-black/20 flex items-center justify-between gap-2">
                    <div className="font-mono truncate opacity-85 min-w-0">
                      {v.address || shortHash(v.txid, 10, 8)}
                    </div>
                    {v.value_ltc !== null && v.value_ltc !== undefined && (
                      <div className="font-semibold tabular-nums shrink-0">{v.value_ltc} Ł</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="m3-glass rounded-[22px] p-4 space-y-2">
                <div className="font-semibold opacity-75 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--m3-primary)' }} />
                  {t('outputs')} ({txData.vout?.length ?? 0})
                </div>
                {(txData.vout ?? []).map((v: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-black/20 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono truncate opacity-85">{v.address}</div>
                      <div className="text-[10px] opacity-55">{v.type}</div>
                    </div>
                    <div className="font-semibold tabular-nums shrink-0">{v.value_ltc} Ł</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
