import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, FileCode2, Lock, Send, ShieldCheck, Terminal } from 'lucide-react';
import { api } from '../../api';
import { useT } from '../../i18n';
import { Lang } from '../../types';
import { copyToClipboard } from '../../utils';

interface ToolsViewProps {
  lang: Lang;
  authenticated: boolean;
  onRequireAuth: () => void;
}

export const ToolsView: React.FC<ToolsViewProps> = ({ lang, authenticated, onRequireAuth }) => {
  const t = useT(lang);

  // RPC Console
  const [rpcCatalog, setRpcCatalog] = useState<Array<{ method: string; hint: string }>>([]);
  const [rpcInput, setRpcInput] = useState('getblockchaininfo');
  const [safeMode, setSafeMode] = useState(true);
  const [rpcOutput, setRpcOutput] = useState<string>('');
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  // Raw TX Studio
  const [rawHex, setRawHex] = useState('');
  const [txResult, setTxResult] = useState<string>('');
  const [txError, setTxError] = useState<string | null>(null);

  // Verify Message
  const [vAddr, setVAddr] = useState('');
  const [vSig, setVSig] = useState('');
  const [vMsg, setVMsg] = useState('');
  const [vStatus, setVStatus] = useState<string | null>(null);

  // Config Generator
  const [cfgPruned, setCfgPruned] = useState(false);
  const [cfgPruneMb, setCfgPruneMb] = useState(10000);
  const [cfgTor, setCfgTor] = useState(false);
  const [cfgCache, setCfgCache] = useState(1024);
  const [cfgText, setCfgText] = useState('');
  const [copiedCfg, setCopiedCfg] = useState(false);

  useEffect(() => {
    api.rpcHelp().then((r) => setRpcCatalog(r.commands)).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getConfigSnippet(cfgPruned, cfgPruneMb, cfgTor, cfgCache)
      .then((r) => setCfgText(r.litecoin_conf))
      .catch(() => {});
  }, [cfgPruned, cfgPruneMb, cfgTor, cfgCache]);

  const executeRpc = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!authenticated) {
      onRequireAuth();
      return;
    }
    const raw = rpcInput.trim();
    if (!raw) return;
    const parts = raw.split(/\s+/);
    const method = parts[0];
    const params = parts.slice(1).map((tok) => {
      if (tok === 'true') return true;
      if (tok === 'false') return false;
      if (/^-?\d+$/.test(tok)) return Number(tok);
      try {
        return JSON.parse(tok);
      } catch {
        return tok;
      }
    });

    setRpcLoading(true);
    setRpcError(null);
    setHistory((h) => [raw, ...h.filter((x) => x !== raw)].slice(0, 20));
    setHistIdx(-1);
    try {
      const res = await api.rpcExec(method, params, safeMode);
      setRpcOutput(JSON.stringify(res.result, null, 2));
    } catch (err: any) {
      if (err.status === 401) onRequireAuth();
      setRpcError(err.message);
    } finally {
      setRpcLoading(false);
    }
  };

  const handleDecode = async () => {
    setTxError(null);
    try {
      const res = await api.decodeTx(rawHex);
      setTxResult(JSON.stringify(res.decoded, null, 2));
    } catch (e: any) {
      setTxError(e.message);
    }
  };

  const handleBroadcast = async () => {
    if (!authenticated) {
      onRequireAuth();
      return;
    }
    setTxError(null);
    try {
      const res = await api.broadcastTx(rawHex);
      setTxResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setTxError(e.message);
    }
  };

  const handleVerifyMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    setVStatus(null);
    try {
      const res = await api.verifyMessage(vAddr, vSig, vMsg);
      setVStatus(res.valid ? 'VALID signature' : 'INVALID signature');
    } catch (err: any) {
      setVStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Interactive RPC Console */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
            >
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">{t('rpcConsoleTitle')}</h2>
              <p className="text-xs opacity-65">
                {authenticated ? 'Admin session unlocked' : 'Admin unlock required to execute RPC'}
              </p>
            </div>
          </div>

          <label className="m3-glass-elevated m3-pill px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('safeMode')}</span>
            <input
              type="checkbox"
              checked={safeMode}
              onChange={(e) => setSafeMode(e.target.checked)}
              className="accent-emerald-400"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {rpcCatalog.slice(0, 8).map((cmd) => (
            <button
              key={cmd.method}
              onClick={() => setRpcInput(cmd.method)}
              title={cmd.hint}
              className="px-3 py-1 m3-pill text-[11px] font-mono bg-white/10 hover:bg-white/20 transition"
            >
              {cmd.method}
            </button>
          ))}
        </div>

        <form onSubmit={executeRpc} className="flex flex-col sm:flex-row gap-2">
          <input
            value={rpcInput}
            onChange={(e) => setRpcInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' && history.length) {
                const next = Math.min(history.length - 1, histIdx + 1);
                setHistIdx(next);
                setRpcInput(history[next]);
              } else if (e.key === 'ArrowDown' && histIdx >= 0) {
                const next = histIdx - 1;
                setHistIdx(next);
                setRpcInput(next >= 0 ? history[next] : '');
              }
            }}
            placeholder="getblockchaininfo | getblockhash 100"
            className="flex-1 px-4 py-2.5 rounded-full bg-black/30 border border-white/15 outline-none focus:border-blue-400 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={rpcLoading}
            className="m3-pill px-5 py-2.5 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
            style={{ background: 'var(--m3-primary-strong)' }}
          >
            {!authenticated && <Lock className="w-3.5 h-3.5" />}
            <span>{rpcLoading ? '…' : t('execute')}</span>
          </button>
        </form>

        {rpcError && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300">{rpcError}</div>
        )}
        {rpcOutput && (
          <pre className="p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-[11px] overflow-x-auto max-h-72 text-emerald-200">
            {rpcOutput}
          </pre>
        )}
      </div>

      {/* Raw TX Studio & Verify Message */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="m3-glass m3-card p-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Send className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            <span>{t('rawTxTitle')}</span>
          </div>
          <textarea
            value={rawHex}
            onChange={(e) => setRawHex(e.target.value)}
            rows={4}
            placeholder="020000000001..."
            className="w-full p-3 rounded-2xl bg-black/30 border border-white/15 outline-none focus:border-blue-400 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDecode}
              disabled={!rawHex.trim()}
              className="m3-glass-elevated m3-pill px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {t('decodeHex')}
            </button>
            <button
              onClick={handleBroadcast}
              disabled={!rawHex.trim()}
              className="m3-pill px-4 py-2 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'var(--m3-primary-strong)' }}
            >
              {!authenticated && <Lock className="w-3 h-3" />}
              {t('broadcastTx')}
            </button>
          </div>
          {txError && <div className="text-xs text-rose-300">{txError}</div>}
          {txResult && (
            <pre className="p-3 rounded-2xl bg-black/40 font-mono text-[11px] overflow-x-auto max-h-52">{txResult}</pre>
          )}
        </div>

        <div className="m3-glass m3-card p-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-base">
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            <span>{t('verifyMsgTitle')}</span>
          </div>
          <form onSubmit={handleVerifyMsg} className="space-y-2.5 text-xs">
            <input
              value={vAddr}
              onChange={(e) => setVAddr(e.target.value)}
              placeholder="Litecoin Address (L... / ltc1...)"
              className="w-full px-3.5 py-2 rounded-2xl bg-black/30 border border-white/15 outline-none font-mono"
            />
            <input
              value={vSig}
              onChange={(e) => setVSig(e.target.value)}
              placeholder="Base64 Signature"
              className="w-full px-3.5 py-2 rounded-2xl bg-black/30 border border-white/15 outline-none font-mono"
            />
            <textarea
              value={vMsg}
              onChange={(e) => setVMsg(e.target.value)}
              rows={2}
              placeholder="Message text"
              className="w-full p-3 rounded-2xl bg-black/30 border border-white/15 outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="submit"
                className="m3-pill px-4 py-2 text-xs font-semibold text-white"
                style={{ background: 'var(--m3-primary-strong)' }}
              >
                {t('verifyBtn')}
              </button>
              {vStatus && <span className="font-semibold text-emerald-300">{vStatus}</span>}
            </div>
          </form>
        </div>
      </div>

      {/* Config Generator */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-base">
            <FileCode2 className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            <span>{t('configGenTitle')}</span>
          </div>
          <button
            onClick={async () => {
              if (await copyToClipboard(cfgText)) {
                setCopiedCfg(true);
                setTimeout(() => setCopiedCfg(false), 1500);
              }
            }}
            className="m3-glass-elevated m3-pill px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
          >
            {copiedCfg ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCfg ? t('copied') : t('copy')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfgPruned} onChange={(e) => setCfgPruned(e.target.checked)} />
            <span>Pruned Node</span>
          </label>
          {cfgPruned && (
            <input
              type="number"
              value={cfgPruneMb}
              onChange={(e) => setCfgPruneMb(Number(e.target.value) || 10000)}
              className="w-28 px-3 py-1 rounded-full bg-black/25 border border-white/15 tabular-nums"
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfgTor} onChange={(e) => setCfgTor(e.target.checked)} />
            <span>Tor Proxy (tor:9050)</span>
          </label>
          <label className="flex items-center gap-2">
            <span>dbcache (MB):</span>
            <input
              type="number"
              value={cfgCache}
              onChange={(e) => setCfgCache(Number(e.target.value) || 1024)}
              className="w-24 px-3 py-1 rounded-full bg-black/25 border border-white/15 tabular-nums"
            />
          </label>
        </div>

        <pre className="p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs overflow-x-auto">
          {cfgText}
        </pre>
      </div>
    </div>
  );
};
