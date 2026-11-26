from typing import Any

from fastapi import APIRouter

from ..rpc import NodeOfflineError, NodeWarmupError, RpcCallError, rpc_client

router = APIRouter(prefix="/api", tags=["mempool"])


@router.get("/mempool")
async def get_mempool() -> dict[str, Any]:
    try:
        res = await rpc_client.batch([
            ("getmempoolinfo", []),
            ("getrawmempool", [True]),
            ("estimatesmartfee", [1]),
            ("estimatesmartfee", [3]),
            ("estimatesmartfee", [6]),
            ("estimatesmartfee", [24]),
        ])
    except (NodeOfflineError, NodeWarmupError, RpcCallError) as exc:
        return {
            "unavailable": True,
            "reason": str(exc),
            "stats": {"size": 0, "bytes": 0, "usage": 0, "maxmempool": 300_000_000, "mempoolminfee_lit_vb": 1.0, "total_fee_ltc": 0.0},
            "fees": {"next_block": 1.0, "half_hour": 1.0, "hour": 1.0, "economy": 1.0},
            "histogram": [],
            "next_block_preview": {"tx_count": 0, "weight": 0, "max_weight": 4_000_000, "fill_pct": 0.0, "total_fees_ltc": 0.0, "fee_range_lit_vb": [0.0, 0.0], "source": "unavailable"},
            "recent_txs": [],
        }

    mem_info = res[0][0] or {}
    raw_mempool = res[1][0] if isinstance(res[1][0], dict) else {}

    min_fee_lit_vb = round(max(1.0, float(mem_info.get("mempoolminfee", 0.00001) or 0.00001) * 1e5), 2)

    def _extract_fee(idx: int, fallback: float) -> float:
        obj = res[idx][0]
        if isinstance(obj, dict) and obj.get("feerate"):
            return round(max(1.0, float(obj["feerate"]) * 1e5), 2)
        return fallback

    fee_economy = _extract_fee(5, min_fee_lit_vb)
    fee_hour = _extract_fee(4, round(max(min_fee_lit_vb, fee_economy * 1.15), 2))
    fee_half = _extract_fee(3, round(max(fee_hour, fee_hour * 1.25), 2))
    fee_next = _extract_fee(2, round(max(fee_half, fee_half * 1.3), 2))

    buckets = [
        {"bucket": "1–2", "min": 0.0, "max": 2.0, "count": 0, "vbytes": 0},
        {"bucket": "2–4", "min": 2.0, "max": 4.0, "count": 0, "vbytes": 0},
        {"bucket": "4–8", "min": 4.0, "max": 8.0, "count": 0, "vbytes": 0},
        {"bucket": "8–15", "min": 8.0, "max": 15.0, "count": 0, "vbytes": 0},
        {"bucket": "15–30", "min": 15.0, "max": 30.0, "count": 0, "vbytes": 0},
        {"bucket": "30+", "min": 30.0, "max": 1e9, "count": 0, "vbytes": 0},
    ]
    entries: list[dict[str, Any]] = []
    total_fee_ltc = 0.0

    for txid, info in raw_mempool.items():
        if not isinstance(info, dict):
            continue
        vsize = int(info.get("vsize", info.get("size", 140)) or 140)
        fees_obj = info.get("fees") if isinstance(info.get("fees"), dict) else {}
        base_fee = float(fees_obj.get("base", info.get("fee", 0.0)) or 0.0)
        total_fee_ltc += base_fee
        feerate_lit_vb = round((base_fee * 1e8) / max(1, vsize), 2)
        for b in buckets:
            if b["min"] <= feerate_lit_vb < b["max"]:
                b["count"] += 1
                b["vbytes"] += vsize
                break
        entries.append({
            "txid": txid,
            "vsize": vsize,
            "weight": int(info.get("weight", vsize * 4) or vsize * 4),
            "fee_ltc": round(base_fee, 8),
            "feerate_lit_vb": feerate_lit_vb,
            "time": int(info.get("time", 0)),
            "bip125_replaceable": bool(info.get("bip125-replaceable", False)),
            "is_mweb": False,
        })

    next_preview: dict[str, Any]
    try:
        tpl = await rpc_client.call("getblocktemplate", [{"rules": ["segwit", "mweb"]}])
        tpl_txs = tpl.get("transactions", []) if isinstance(tpl, dict) else []
        tpl_weight = sum(int(t.get("weight", 0)) for t in tpl_txs)
        tpl_fees = sum(int(t.get("fee", 0)) for t in tpl_txs) / 1e8
        rates = [round((int(t.get("fee", 0)) * 4.0) / max(1, int(t.get("weight", 4))), 2) for t in tpl_txs]
        next_preview = {
            "tx_count": len(tpl_txs),
            "weight": tpl_weight,
            "max_weight": 4_000_000,
            "fill_pct": round(min(100.0, (tpl_weight / 4_000_000) * 100.0), 1),
            "total_fees_ltc": round(tpl_fees, 8),
            "fee_range_lit_vb": [min(rates), max(rates)] if rates else [0.0, 0.0],
            "source": "getblocktemplate",
        }
    except Exception:
        sorted_by_fee = sorted(entries, key=lambda x: x["feerate_lit_vb"], reverse=True)
        packed_weight = 0
        packed_fees = 0.0
        packed_rates: list[float] = []
        packed_count = 0
        for e in sorted_by_fee:
            if packed_weight + e["weight"] > 3_960_000:
                break
            packed_weight += e["weight"]
            packed_fees += e["fee_ltc"]
            packed_rates.append(e["feerate_lit_vb"])
            packed_count += 1
        next_preview = {
            "tx_count": packed_count,
            "weight": packed_weight,
            "max_weight": 4_000_000,
            "fill_pct": round(min(100.0, (packed_weight / 4_000_000) * 100.0), 1),
            "total_fees_ltc": round(packed_fees, 8),
            "fee_range_lit_vb": [min(packed_rates), max(packed_rates)] if packed_rates else [0.0, 0.0],
            "source": "mempool_estimate",
        }

    entries.sort(key=lambda x: x["time"], reverse=True)
    return {
        "stats": {
            "size": int(mem_info.get("size", 0)),
            "bytes": int(mem_info.get("bytes", 0)),
            "usage": int(mem_info.get("usage", 0)),
            "maxmempool": int(mem_info.get("maxmempool", 300_000_000)),
            "mempoolminfee_lit_vb": min_fee_lit_vb,
            "total_fee_ltc": round(total_fee_ltc, 8),
        },
        "fees": {
            "next_block": fee_next,
            "half_hour": fee_half,
            "hour": fee_hour,
            "economy": fee_economy,
        },
        "histogram": [{"bucket": b["bucket"], "count": b["count"], "vbytes": b["vbytes"]} for b in buckets],
        "next_block_preview": next_preview,
        "recent_txs": entries[:25],
    }
