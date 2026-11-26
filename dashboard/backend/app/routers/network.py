import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import read_onion_hostname, runtime_state, settings
from ..rpc import NodeOfflineError, NodeWarmupError, RpcCallError, rpc_client

router = APIRouter(prefix="/api", tags=["network"])

_price_cache: dict[str, Any] = {"ts": 0.0, "data": None}
_geo_cache: dict[str, dict[str, str]] = {}


class PrivacySettingsUpdate(BaseModel):
    enable_price_ticker: Optional[bool] = None
    enable_geoip: Optional[bool] = None


def _proxy_url() -> Optional[str]:
    if not settings.external_proxy:
        return None
    if "://" in settings.external_proxy:
        return settings.external_proxy
    return f"socks5://{settings.external_proxy}"


def _extract_ip(addr: str) -> str:
    if addr.startswith("["):
        return addr[1:].split("]")[0]
    return addr.split(":")[0]


async def _lookup_geoip_batch(ips: list[str]) -> None:
    to_fetch = [ip for ip in ips if ip and ip not in _geo_cache and not ip.endswith(".onion") and not ip.startswith("127.") and not ip.startswith("10.") and not ip.startswith("192.168.")][:25]
    if not to_fetch:
        return
    try:
        async with httpx.AsyncClient(proxy=_proxy_url(), timeout=6.0) as client:
            resp = await client.post(
                "http://ip-api.com/batch?fields=query,countryCode,city,status",
                json=to_fetch,
            )
            if resp.status_code == 200:
                for row in resp.json():
                    if isinstance(row, dict) and row.get("status") == "success":
                        _geo_cache[row["query"]] = {
                            "country_code": row.get("countryCode", ""),
                            "city": row.get("city", ""),
                        }
    except Exception:
        pass


@router.get("/network")
async def get_network() -> dict[str, Any]:
    onion_host = read_onion_hostname()
    try:
        res = await rpc_client.batch([
            ("getnetworkinfo", []),
            ("getnettotals", []),
            ("getpeerinfo", []),
        ])
    except (NodeOfflineError, NodeWarmupError, RpcCallError) as exc:
        return {
            "unavailable": True,
            "reason": str(exc),
            "privacy": {
                "proxy_configured": bool(settings.external_proxy),
                "proxy_address": settings.external_proxy or None,
                "onlynet_onion": False,
                "tor_onion_host": onion_host,
                "networks": [],
            },
            "totals": {"totalbytesrecv": 0, "totalbytessent": 0, "timemillis": int(time.time() * 1000)},
            "connections": 0,
            "connections_in": 0,
            "connections_out": 0,
            "peers": [],
        }

    net_info = res[0][0] or {}
    totals = res[1][0] or {}
    raw_peers = res[2][0] if isinstance(res[2][0], list) else []

    if runtime_state.enable_geoip and raw_peers:
        await _lookup_geoip_batch([_extract_ip(str(p.get("addr", ""))) for p in raw_peers])

    peers: list[dict[str, Any]] = []
    for p in raw_peers:
        addr = str(p.get("addr", ""))
        ip = _extract_ip(addr)
        geo = _geo_cache.get(ip, {}) if runtime_state.enable_geoip else {}
        peers.append({
            "id": p.get("id"),
            "addr": addr,
            "network": p.get("network", "onion" if ".onion" in addr else "ipv4"),
            "inbound": bool(p.get("inbound", False)),
            "subver": p.get("subver", ""),
            "version": p.get("version", 0),
            "pingtime_ms": round(float(p.get("pingtime", 0.0) or 0.0) * 1000.0, 1),
            "synced_headers": int(p.get("synced_headers", -1)),
            "synced_blocks": int(p.get("synced_blocks", -1)),
            "bytessent": int(p.get("bytessent", 0)),
            "bytesrecv": int(p.get("bytesrecv", 0)),
            "conntime": int(p.get("conntime", 0)),
            "country_code": "ONION" if ".onion" in addr else geo.get("country_code"),
            "city": "Tor v3" if ".onion" in addr else geo.get("city"),
        })

    networks = net_info.get("networks", []) if isinstance(net_info.get("networks"), list) else []
    proxy_from_rpc = ""
    for n in networks:
        if n.get("proxy"):
            proxy_from_rpc = str(n["proxy"])
            break

    return {
        "privacy": {
            "proxy_configured": bool(settings.external_proxy or proxy_from_rpc),
            "proxy_address": settings.external_proxy or proxy_from_rpc or None,
            "onlynet_onion": all(
                (not n.get("reachable", False)) or n.get("name") == "onion"
                for n in networks
            ) if networks else False,
            "tor_onion_host": onion_host,
            "networks": [
                {
                    "name": n.get("name"),
                    "limited": bool(n.get("limited", False)),
                    "reachable": bool(n.get("reachable", False)),
                }
                for n in networks
            ],
        },
        "totals": {
            "totalbytesrecv": int(totals.get("totalbytesrecv", 0)),
            "totalbytessent": int(totals.get("totalbytessent", 0)),
            "timemillis": int(totals.get("timemillis", time.time() * 1000)),
        },
        "connections": int(net_info.get("connections", len(peers))),
        "connections_in": sum(1 for p in peers if p["inbound"]),
        "connections_out": sum(1 for p in peers if not p["inbound"]),
        "peers": peers,
    }


@router.get("/privacy/settings")
async def get_privacy_settings() -> dict[str, Any]:
    return {
        "enable_price_ticker": runtime_state.enable_price_ticker,
        "enable_geoip": runtime_state.enable_geoip,
        "external_proxy": settings.external_proxy or None,
    }


@router.post("/privacy/settings")
async def update_privacy_settings(req: PrivacySettingsUpdate) -> dict[str, Any]:
    if req.enable_price_ticker is not None:
        runtime_state.enable_price_ticker = req.enable_price_ticker
    if req.enable_geoip is not None:
        runtime_state.enable_geoip = req.enable_geoip
    return await get_privacy_settings()


@router.get("/market/price")
async def get_market_price() -> dict[str, Any]:
    if not runtime_state.enable_price_ticker:
        return {"enabled": False, "usd": None, "eur": None, "change_24h": None}

    now = time.time()
    if _price_cache["data"] and (now - _price_cache["ts"]) < 60.0:
        return _price_cache["data"]

    try:
        async with httpx.AsyncClient(proxy=_proxy_url(), timeout=8.0) as client:
            resp = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "litecoin", "vs_currencies": "usd,eur", "include_24hr_change": "true"},
            )
            resp.raise_for_status()
            ltc = resp.json().get("litecoin", {})
            data = {
                "enabled": True,
                "usd": ltc.get("usd"),
                "eur": ltc.get("eur"),
                "change_24h": round(float(ltc.get("usd_24h_change", 0.0) or 0.0), 2),
                "updated_at": int(now),
            }
            _price_cache["ts"] = now
            _price_cache["data"] = data
            return data
    except Exception as exc:
        return {"enabled": True, "error": str(exc), "usd": None, "eur": None, "change_24h": None}
