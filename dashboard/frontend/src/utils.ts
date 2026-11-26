export function formatBytes(bytes: number | undefined | null, decimals = 2): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1000;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`;
}

export function formatHashrate(hs: number | undefined | null): string {
  if (!hs || hs <= 0) return '0 H/s';
  if (hs >= 1e15) return `${(hs / 1e15).toFixed(2)} PH/s`;
  if (hs >= 1e12) return `${(hs / 1e12).toFixed(1)} TH/s`;
  if (hs >= 1e9) return `${(hs / 1e9).toFixed(1)} GH/s`;
  return `${(hs / 1e6).toFixed(1)} MH/s`;
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}

export function formatTimeAgo(unixSeconds: number | undefined | null): string {
  if (!unixSeconds) return '—';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function shortHash(hash: string | undefined | null, head = 8, tail = 8): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
