import React, { useEffect, useState } from 'react';
import { Ban, Check, Copy, Globe, Network, Plus, Shield, ShieldCheck, Unplug } from 'lucide-react';
import { api } from '../../api';
import { useT } from '../../i18n';
import { Lang, NetworkData } from '../../types';
import { copyToClipboard, formatBytes } from '../../utils';
import { DualSparkline } from '../GlassCharts';

interface NetworkViewProps {
  lang: Lang;
  authenticated: boolean;
  onRequireAuth: () => void;
}

export const NetworkView: React.FC<NetworkViewProps> = ({ lang, authenticated, onRequireAuth }) => {
  const t = useT(lang);
  const [data, setData] = useState<NetworkData | null>(null);
  const [samples, setSamples] = useState<Array<{ rx: number; tx: number }>>([]);
  const [lastTotals, setLastTotals] = useState<{ rx: number; tx: number } | null>(null);
  const [filter, setFilter] = useState('');
  const [newPeer, setNewPeer] = useState('');
  const [copiedOnion, setCopiedOnion] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await api.getNetwork();
    setData(res);
    setLastTotals((prev) => {
      if (prev) {
        const drx = Math.max(0, res.totals.totalbytesrecv - prev.rx);
        const dtx = Math.max(0, res.totals.totalbytessent - prev.tx);
        setSamples((s) => [...s.slice(-24), { rx: drx, tx: dtx }]);
      }
      return { rx: res.totals.totalbytesrecv, tx: res.totals.totalbytessent };
    });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const runAdminAction = async (fn: () => Promise<any>, msg: string) => {
    if (!authenticated) {
      onRequireAuth();
      return;
    }
    try {
      await fn();
      setActionMsg(msg);
      setTimeout(() => setActionMsg(null), 3000);
      load();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  };

  const peers = (data?.peers ?? []).filter(
    (p) =>
      p.addr.toLowerCase().includes(filter.toLowerCase()) ||
      p.subver.toLowerCase().includes(filter.toLowerCase())
  );

  const privacy = data?.privacy;

  return (
    <div className="space-y-5">
      {/* Privacy & Bandwidth Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="m3-glass m3-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-300">
                {privacy?.proxy_configured ? <ShieldCheck className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-base">{t('connectivityPrivacy')}</h3>
                <p className="text-xs opacity-65">
                  {privacy?.proxy_configured ? `${t('proxyStatus')}: ${privacy.proxy_address}` : t('directP2p')}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 m3-pill text-xs font-medium ${
                privacy?.onlynet_onion ? 'bg-violet-500/20 text-violet-300' : 'bg-white/10'
              }`}
            >
              {privacy?.onlynet_onion ? 'Tor Only' : 'Hybrid / Clearnet'}
            </span>
          </div>

          {privacy?.tor_onion_host ? (
            <div className="p-3.5 rounded-2xl bg-black/25 border border-emerald-400/25 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-emerald-300 font-semibold">{t('torHiddenService')}</div>
                <div className="font-mono truncate mt-0.5">{privacy.tor_onion_host}:9333</div>
              </div>
              <button
                onClick={async () => {
                  if (await copyToClipboard(`${privacy.tor_onion_host}:9333`)) {
                    setCopiedOnion(true);
                    setTimeout(() => setCopiedOnion(false), 1500);
                  }
                }}
                className="m3-glass m3-pill px-3 py-1.5 inline-flex items-center gap-1 shrink-0"
              >
                {copiedOnion ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedOnion ? t('copied') : t('copy')}
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-black/20 text-xs opacity-75 leading-relaxed flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
              <span>{t('torEnableHint')}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(privacy?.networks ?? []).map((n) => (
              <span
                key={n.name}
                className={`px-3 py-1 m3-pill text-xs border ${
                  n.reachable ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300' : 'bg-white/5 border-white/10 opacity-55'
                }`}
              >
                {n.name.toUpperCase()} {n.reachable ? 'Reachable' : 'Limited'}
              </span>
            ))}
          </div>
        </div>

        <div className="m3-glass m3-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
              >
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{t('bandwidthTitle')}</h3>
                <p className="text-xs opacity-65 tabular-nums">
                  {data?.connections_in ?? 0} in / {data?.connections_out ?? 0} out
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
            <div className="p-3.5 rounded-2xl bg-black/20">
              <div className="opacity-60 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {t('received')}
              </div>
              <div className="text-lg font-bold mt-0.5">{formatBytes(data?.totals.totalbytesrecv)}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/20">
              <div className="opacity-60 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--m3-primary)' }} />
                {t('sent')}
              </div>
              <div className="text-lg font-bold mt-0.5">{formatBytes(data?.totals.totalbytessent)}</div>
            </div>
          </div>

          <DualSparkline samples={samples} />
        </div>
      </div>

      {/* Peers List */}
      <div className="m3-glass m3-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-base">
            {t('connectedPeers')} ({peers.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter IP / client…"
              className="px-3.5 py-1.5 rounded-full bg-black/25 border border-white/15 outline-none text-xs"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPeer.trim()) return;
                runAdminAction(() => api.addPeer(newPeer.trim(), 'onetry'), `Requested connection to ${newPeer}`);
                setNewPeer('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                value={newPeer}
                onChange={(e) => setNewPeer(e.target.value)}
                placeholder="ip:9333"
                className="w-36 px-3.5 py-1.5 rounded-full bg-black/25 border border-white/15 outline-none text-xs font-mono"
              />
              <button
                type="submit"
                className="m3-pill px-3 py-1.5 text-xs font-medium text-white inline-flex items-center gap-1"
                style={{ background: 'var(--m3-primary-strong)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('addPeer')}
              </button>
            </form>
          </div>
        </div>

        {actionMsg && (
          <div className="px-4 py-2 rounded-2xl bg-blue-500/15 border border-blue-400/25 text-xs text-blue-200">
            {actionMsg}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="py-2.5 pr-3">Address</th>
                <th className="py-2.5 pr-3">Direction</th>
                <th className="py-2.5 pr-3">Client</th>
                <th className="py-2.5 pr-3">Ping</th>
                <th className="py-2.5 pr-3">Height</th>
                <th className="py-2.5 pr-3">Traffic</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 tabular-nums">
              {peers.map((p) => (
                <tr key={`${p.id}-${p.addr}`} className="hover:bg-white/5">
                  <td className="py-3 pr-3 font-mono">
                    <div className="flex items-center gap-2">
                      {p.country_code && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-sans">{p.country_code}</span>
                      )}
                      <span>{p.addr}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        p.inbound ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {p.inbound ? 'Inbound' : 'Outbound'}
                    </span>
                  </td>
                  <td className="py-3 pr-3 opacity-85">{p.subver}</td>
                  <td className="py-3 pr-3">{p.pingtime_ms} ms</td>
                  <td className="py-3 pr-3">{p.synced_blocks >= 0 ? p.synced_blocks.toLocaleString() : '—'}</td>
                  <td className="py-3 pr-3 opacity-75">
                    ↓{formatBytes(p.bytesrecv, 0)} / ↑{formatBytes(p.bytessent, 0)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => runAdminAction(() => api.disconnectPeer(p.addr), `Disconnected ${p.addr}`)}
                        className="p-1.5 rounded-full hover:bg-white/10 opacity-75 hover:opacity-100"
                        title={t('disconnect')}
                      >
                        <Unplug className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          runAdminAction(
                            () => api.banPeer(p.addr.split(':')[0], 'add', 86400),
                            `Banned ${p.addr.split(':')[0]} for 24h`
                          )
                        }
                        className="p-1.5 rounded-full hover:bg-rose-500/20 text-rose-300 opacity-75 hover:opacity-100"
                        title={t('ban24h')}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
