import { AuthStatus, ChartBlockPoint, MarketPrice, MempoolData, NetworkData, OverviewData, PrivacySettings } from './types';

const TOKEN_KEY = 'ltc_glass_admin_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(path, { ...options, headers });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // ignore
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json() as Promise<T>;
}

export const api = {
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  login: (password: string) =>
    request<{ token: string; expires_at: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getOverview: () => request<OverviewData>('/api/overview'),
  getChartBlocks: (count = 60) =>
    request<{ blocks: ChartBlockPoint[] }>(`/api/chart/blocks?count=${count}`),
  getMempool: () => request<MempoolData>('/api/mempool'),
  getBlocks: (limit = 25, startHeight?: number) =>
    request<{ tip_height: number; blocks: any[] }>(
      `/api/blocks?limit=${limit}${startHeight !== undefined ? `&start_height=${startHeight}` : ''}`
    ),
  getBlockDetail: (id: string) =>
    request<{ block: any }>(`/api/block/${encodeURIComponent(id)}`),
  getTxDetail: (txid: string, blockhash?: string | null) =>
    request<{ tx: any }>(
      `/api/tx/${encodeURIComponent(txid)}${blockhash ? `?blockhash=${encodeURIComponent(blockhash)}` : ''}`
    ),
  scanAddress: (address: string) =>
    request<any>(`/api/address/${encodeURIComponent(address)}/utxos`),
  search: (q: string) =>
    request<{ kind: 'block' | 'tx' | 'address'; target: string }>(
      `/api/search?q=${encodeURIComponent(q)}`
    ),
  getNetwork: () => request<NetworkData>('/api/network'),
  getPrivacySettings: () => request<PrivacySettings>('/api/privacy/settings'),
  updatePrivacySettings: (payload: Partial<PrivacySettings>) =>
    request<PrivacySettings>('/api/privacy/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMarketPrice: () => request<MarketPrice>('/api/market/price'),
  rpcHelp: () => request<{ commands: Array<{ method: string; hint: string }> }>('/api/rpc/help'),
  rpcExec: (method: string, params: any[], safe_mode: boolean) =>
    request<{ method: string; result: any }>('/api/rpc/exec', {
      method: 'POST',
      body: JSON.stringify({ method, params, safe_mode }),
    }),
  addPeer: (node: string, command = 'onetry') =>
    request('/api/peers/add', { method: 'POST', body: JSON.stringify({ node, command }) }),
  disconnectPeer: (address: string) =>
    request('/api/peers/disconnect', { method: 'POST', body: JSON.stringify({ address }) }),
  banPeer: (subnet: string, command = 'add', bantime = 86400) =>
    request('/api/peers/ban', { method: 'POST', body: JSON.stringify({ subnet, command, bantime }) }),
  decodeTx: (hexstring: string) =>
    request<{ decoded: any }>('/api/tx/decode', { method: 'POST', body: JSON.stringify({ hexstring }) }),
  broadcastTx: (hexstring: string) =>
    request<{ ok: boolean; txid: string }>('/api/tx/broadcast', {
      method: 'POST',
      body: JSON.stringify({ hexstring }),
    }),
  verifyMessage: (address: string, signature: string, message: string) =>
    request<{ valid: boolean }>('/api/message/verify', {
      method: 'POST',
      body: JSON.stringify({ address, signature, message }),
    }),
  getConfigSnippet: (pruned: boolean, prune_mb: number, tor_proxy: boolean, db_cache: number) =>
    request<{ litecoin_conf: string; p2p_port: number; onion_host: string | null }>(
      `/api/config/generator?pruned=${pruned}&prune_mb=${prune_mb}&tor_proxy=${tor_proxy}&db_cache=${db_cache}`
    ),
};
