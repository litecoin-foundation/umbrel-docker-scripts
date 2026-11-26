export type ThemeMode = 'dark' | 'light';
export type AccentSeed = 'cobalt' | 'silver' | 'mweb' | 'violet';
export type Lang = 'en';
export type NavTab = 'overview' | 'mempool' | 'explorer' | 'network' | 'tools';

export interface BlockSummary {
  height: number;
  hash: string;
  time: number;
  tx_count: number;
  size: number;
  strippedsize?: number;
  weight?: number;
  difficulty?: number;
  confirmations?: number;
  miner?: string | null;
  has_mweb?: boolean;
  mweb_kernels?: number;
  mweb_outputs?: number;
  version_hex?: string;
  merkle_root?: string;
  previousblockhash?: string | null;
  nextblockhash?: string | null;
}

export interface HalvingInfo {
  current_height: number;
  era: number;
  epoch_start: number;
  next_halving_height: number;
  remaining_blocks: number;
  progress_pct: number;
  current_subsidy_ltc: number;
  next_subsidy_ltc: number;
  estimated_seconds: number;
  estimated_timestamp: number;
}

export interface OverviewData {
  status: 'synced' | 'syncing' | 'warming_up' | 'offline';
  status_message: string;
  chain?: string;
  version?: number;
  subversion?: string;
  protocol_version?: number;
  uptime_seconds?: number;
  blocks: number;
  headers: number;
  network_tip?: number;
  sync_stage?: 'headers' | 'blocks' | 'synced';
  header_progress?: number;
  headers_per_sec?: number;
  verification_progress: number;
  initial_block_download: boolean;
  sync_speed_bps?: number;
  sync_eta_seconds?: number | null;
  difficulty?: number;
  network_hashrate_hs?: number;
  size_on_disk_bytes?: number;
  pruned?: boolean;
  txindex?: boolean;
  connections?: number;
  connections_in?: number;
  connections_out?: number;
  mempool_tx_count?: number;
  mempool_bytes?: number;
  mempool_max_bytes?: number;
  mempool_min_fee_lit_vb?: number;
  fastest_fee_lit_vb?: number;
  mweb?: {
    active: boolean;
    latest_block_has_mweb: boolean;
    pegged_in_estimate_ltc: number | null;
    recent_kernels: number;
    recent_outputs?: number;
    hogex_enabled: boolean;
  };
  softforks?: Array<{
    name: string;
    active: boolean;
    type: string;
    status?: string | null;
    height?: number | null;
  }>;
  onion_host?: string | null;
  halving: HalvingInfo;
  recent_blocks: BlockSummary[];
}

export interface ChartBlockPoint {
  height: number;
  time: number;
  tx_count: number;
  size_kb: number;
  weight: number;
  interval_s: number;
  has_mweb: boolean;
}

export interface MempoolData {
  unavailable?: boolean;
  reason?: string;
  stats: {
    size: number;
    bytes: number;
    usage: number;
    maxmempool: number;
    mempoolminfee_lit_vb: number;
    total_fee_ltc: number;
  };
  fees: {
    next_block: number;
    half_hour: number;
    hour: number;
    economy: number;
  };
  histogram: Array<{ bucket: string; count: number; vbytes: number }>;
  next_block_preview: {
    tx_count: number;
    weight: number;
    max_weight: number;
    fill_pct: number;
    total_fees_ltc: number;
    fee_range_lit_vb: [number, number];
    source: string;
  };
  recent_txs: Array<{
    txid: string;
    vsize: number;
    fee_ltc: number;
    feerate_lit_vb: number;
    amount_ltc?: number;
    time: number;
    bip125_replaceable: boolean;
    is_mweb?: boolean;
  }>;
}

export interface PeerInfo {
  id: number;
  addr: string;
  network: string;
  inbound: boolean;
  subver: string;
  version: number;
  pingtime_ms: number;
  synced_headers: number;
  synced_blocks: number;
  bytessent: number;
  bytesrecv: number;
  conntime: number;
  country_code?: string | null;
  city?: string | null;
}

export interface NetworkData {
  unavailable?: boolean;
  reason?: string;
  privacy: {
    proxy_configured: boolean;
    proxy_address: string | null;
    onlynet_onion: boolean;
    tor_onion_host: string | null;
    networks: Array<{ name: string; limited: boolean; reachable: boolean }>;
  };
  totals: {
    totalbytesrecv: number;
    totalbytessent: number;
    timemillis: number;
  };
  connections: number;
  connections_in: number;
  connections_out: number;
  peers: PeerInfo[];
}

export interface PrivacySettings {
  enable_price_ticker: boolean;
  enable_geoip: boolean;
  external_proxy: string | null;
}

export interface MarketPrice {
  enabled: boolean;
  usd: number | null;
  eur: number | null;
  change_24h: number | null;
  updated_at?: number;
  error?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  lock_entire_dashboard: boolean;
  admin_configured: boolean;
}
