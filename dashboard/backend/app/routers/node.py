import time
from typing import Any, Optional

from fastapi import APIRouter, Query

from ..config import read_onion_hostname, settings
from ..rpc import NodeOfflineError, NodeWarmupError, RpcCallError, rpc_client

router = APIRouter(prefix="/api", tags=["node"])


def compute_halving(blocks: int) -> dict[str, Any]:
    interval = 840_000
    era = max(0, blocks // interval)
    epoch_start = era * interval
    next_halving = (era + 1) * interval
    current_subsidy = 50.0 / (2 ** era)
    next_subsidy = current_subsidy / 2.0
    remaining_blocks = max(0, next_halving - blocks)
    progress_pct = round(((blocks - epoch_start) / interval) * 100.0, 2)
    est_seconds = remaining_blocks * 150
    est_timestamp = int(time.time()) + est_seconds
    return {
        "current_height": blocks,
        "era": era,
        "epoch_start": epoch_start,
        "next_halving_height": next_halving,
        "remaining_blocks": remaining_blocks,
        "progress_pct": progress_pct,
        "current_subsidy_ltc": current_subsidy,
        "next_subsidy_ltc": next_subsidy,
        "estimated_seconds": est_seconds,
        "estimated_timestamp": est_timestamp,
    }


def _parse_softforks(bc_info: dict[str, Any]) -> list[dict[str, Any]]:
    raw = bc_info.get("softforks")
    forks: list[dict[str, Any]] = []
    if isinstance(raw, dict):
        for name, details in raw.items():
            if not isinstance(details, dict):
                continue
            bip9 = details.get("bip9") if isinstance(details.get("bip9"), dict) else {}
            bip8 = details.get("bip8") if isinstance(details.get("bip8"), dict) else {}
            fork_meta = bip8 or bip9
            since = fork_meta.get("since")
            height = details.get("height") or (since if since else None) or fork_meta.get("start_height")
            forks.append({
                "name": name,
                "active": bool(details.get("active", False)),
                "type": str(details.get("type", "bip9")),
                "status": fork_meta.get("status"),
                "height": height,
            })
    return forks


def _detect_mweb(latest_block: Optional[dict[str, Any]], bc_info: dict[str, Any]) -> dict[str, Any]:
    softforks = bc_info.get("softforks") or {}
    mweb_sf = softforks.get("mweb") if isinstance(softforks, dict) else None
    mweb_active = bool(mweb_sf.get("active", False)) if isinstance(mweb_sf, dict) else False
    mweb_block = latest_block.get("mweb") if isinstance(latest_block, dict) else None
    has_mweb_data = isinstance(mweb_block, dict) and bool(mweb_block)
    kernels = len(mweb_block.get("kernels", [])) if isinstance(mweb_block, dict) and isinstance(mweb_block.get("kernels"), list) else 0
    outputs = len(mweb_block.get("outputs", [])) if isinstance(mweb_block, dict) and isinstance(mweb_block.get("outputs"), list) else 0
    return {
        "active": mweb_active,
        "latest_block_has_mweb": has_mweb_data,
        "pegged_in_estimate_ltc": None,
        "recent_kernels": kernels,
        "recent_outputs": outputs,
        "hogex_enabled": mweb_active,
    }


async def build_live_overview() -> dict[str, Any]:
    onion_host = read_onion_hostname()
    try:
        results = await rpc_client.batch([
            ("getblockchaininfo", []),
            ("getnetworkinfo", []),
            ("getmempoolinfo", []),
            ("getmininginfo", []),
            ("uptime", []),
            ("getpeerinfo", []),
        ])
    except NodeOfflineError as exc:
        return {
            "status": "offline",
            "status_message": f"Waiting for litecoind RPC ({exc})",
            "blocks": 0,
            "headers": 0,
            "network_tip": 0,
            "sync_stage": "headers",
            "header_progress": 0.0,
            "headers_per_sec": 0.0,
            "verification_progress": 0.0,
            "initial_block_download": True,
            "onion_host": onion_host,
            "halving": compute_halving(0),
            "recent_blocks": [],
        }
    except NodeWarmupError as exc:
        return {
            "status": "warming_up",
            "status_message": str(exc),
            "blocks": 0,
            "headers": 0,
            "network_tip": 0,
            "sync_stage": "headers",
            "header_progress": 0.0,
            "headers_per_sec": 0.0,
            "verification_progress": 0.0,
            "initial_block_download": True,
            "onion_host": onion_host,
            "halving": compute_halving(0),
            "recent_blocks": [],
        }

    bc_info = results[0][0] or {}
    net_info = results[1][0] or {}
    mem_info = results[2][0] or {}
    mining_info = results[3][0] or {}
    uptime_sec = int(results[4][0] or 0)
    peers = results[5][0] if isinstance(results[5][0], list) else []

    blocks = int(bc_info.get("blocks", 0))
    headers = int(bc_info.get("headers", 0))
    ibd = bool(bc_info.get("initialblockdownload", False))
    ver_prog = round(float(bc_info.get("verificationprogress", 0.0)) * 100.0, 2)
    if headers > 0 and blocks < headers and ver_prog >= 99.99:
        ver_prog = round((blocks / headers) * 100.0, 2)

    peer_tips = [int(p.get("startingheight", 0) or 0) for p in peers if isinstance(p, dict)]
    network_tip = max([blocks, headers] + peer_tips)
    sync_metrics = rpc_client.record_sync_sample(blocks, headers, network_tip)

    recent_blocks: list[dict[str, Any]] = []
    latest_block_raw: Optional[dict[str, Any]] = None
    count = min(8, blocks + 1)
    if blocks >= 0 and count > 0:
        hash_calls = [("getblockhash", [blocks - i]) for i in range(count)]
        hash_res = await rpc_client.batch(hash_calls)
        hashes = [h for h, err in hash_res if isinstance(h, str) and not err]
        if hashes:
            block_calls = [("getblock", [h, 1]) for h in hashes]
            block_res = await rpc_client.batch(block_calls)
            for idx, (blk, err) in enumerate(block_res):
                if isinstance(blk, dict) and not err:
                    if idx == 0:
                        latest_block_raw = blk
                    rpc_client.cache_block(blk["hash"], blk)
                    mweb_meta = blk.get("mweb") if isinstance(blk.get("mweb"), dict) else {}
                    recent_blocks.append({
                        "height": blk.get("height", 0),
                        "hash": blk.get("hash", ""),
                        "time": blk.get("time", 0),
                        "tx_count": blk.get("nTx", len(blk.get("tx", []))),
                        "size": blk.get("size", 0),
                        "strippedsize": blk.get("strippedsize", 0),
                        "weight": blk.get("weight", 0),
                        "difficulty": blk.get("difficulty", 0),
                        "confirmations": blk.get("confirmations", 0),
                        "miner": None,
                        "has_mweb": bool(mweb_meta),
                        "mweb_kernels": len(mweb_meta.get("kernels", [])) if isinstance(mweb_meta.get("kernels"), list) else 0,
                        "mweb_outputs": len(mweb_meta.get("outputs", [])) if isinstance(mweb_meta.get("outputs"), list) else 0,
                    })

    min_fee_ltc = float(mem_info.get("mempoolminfee", 0.00001) or 0.00001)
    fastest_lit_vb = round(max(1.0, min_fee_ltc * 1e5), 2)
    try:
        fee_res = await rpc_client.call("estimatesmartfee", [2])
        if isinstance(fee_res, dict) and fee_res.get("feerate"):
            fastest_lit_vb = round(max(1.0, float(fee_res["feerate"]) * 1e5), 2)
    except Exception:
        pass

    conn_total = int(net_info.get("connections", 0))
    conn_in = int(net_info.get("connections_in", 0) or 0)
    conn_out = int(net_info.get("connections_out", 0) or 0)
    if conn_total > 0 and conn_in == 0 and conn_out == 0 and peers:
        conn_in = sum(1 for p in peers if isinstance(p, dict) and p.get("inbound"))
        conn_out = len(peers) - conn_in

    status_str = "synced" if (not ibd and headers > 0 and (headers - blocks) <= 2) else "syncing"
    if status_str == "synced":
        status_msg = "Synced"
    elif sync_metrics["sync_stage"] == "headers":
        status_msg = f"Syncing Headers {headers:,} / {network_tip:,}"
    else:
        status_msg = f"Syncing Blocks {blocks:,} / {max(headers, network_tip):,}"

    return {
        "status": status_str,
        "status_message": status_msg,
        "chain": bc_info.get("chain", "main"),
        "version": net_info.get("version", 0),
        "subversion": net_info.get("subversion", ""),
        "protocol_version": net_info.get("protocolversion", 0),
        "uptime_seconds": uptime_sec,
        "blocks": blocks,
        "headers": headers,
        "network_tip": network_tip,
        "sync_stage": sync_metrics["sync_stage"],
        "header_progress": sync_metrics["header_progress"],
        "headers_per_sec": sync_metrics["headers_per_sec"],
        "verification_progress": ver_prog,
        "initial_block_download": ibd,
        "sync_speed_bps": sync_metrics["blocks_per_sec"],
        "sync_eta_seconds": sync_metrics["eta_seconds"],
        "difficulty": float(bc_info.get("difficulty", 0.0)),
        "network_hashrate_hs": float(mining_info.get("networkhashps", 0.0)),
        "size_on_disk_bytes": int(bc_info.get("size_on_disk", 0)),
        "pruned": bool(bc_info.get("pruned", False)),
        "txindex": settings.prune_mb == 0,
        "connections": conn_total,
        "connections_in": conn_in,
        "connections_out": conn_out,
        "mempool_tx_count": int(mem_info.get("size", 0)),
        "mempool_bytes": int(mem_info.get("bytes", 0)),
        "mempool_max_bytes": int(mem_info.get("maxmempool", 300_000_000)),
        "mempool_min_fee_lit_vb": round(min_fee_ltc * 1e5, 2),
        "fastest_fee_lit_vb": fastest_lit_vb,
        "mweb": _detect_mweb(latest_block_raw, bc_info),
        "softforks": _parse_softforks(bc_info),
        "onion_host": onion_host,
        "halving": compute_halving(max(blocks, headers, network_tip)),
        "recent_blocks": recent_blocks,
    }


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "ts": int(time.time())}


@router.get("/overview")
async def get_overview() -> dict[str, Any]:
    return await build_live_overview()


@router.get("/halving")
async def get_halving() -> dict[str, Any]:
    try:
        res = await rpc_client.batch([("getblockchaininfo", []), ("getpeerinfo", [])])
        bc = res[0][0] or {}
        peers = res[1][0] if isinstance(res[1][0], list) else []
        tip = max([int(bc.get("blocks", 0)), int(bc.get("headers", 0))] + [int(p.get("startingheight", 0) or 0) for p in peers if isinstance(p, dict)])
        return compute_halving(tip)
    except (NodeOfflineError, NodeWarmupError, RpcCallError):
        return compute_halving(0)


@router.get("/chart/blocks")
async def get_chart_blocks(count: int = Query(60, ge=5, le=120)) -> dict[str, Any]:
    try:
        bc = await rpc_client.call("getblockchaininfo")
        tip = int(bc.get("blocks", 0))
    except (NodeOfflineError, NodeWarmupError, RpcCallError):
        return {"blocks": []}

    actual_count = min(count, tip + 1)
    if actual_count <= 0:
        return {"blocks": []}

    heights = list(range(tip - actual_count + 1, tip + 1))
    hash_res = await rpc_client.batch([("getblockhash", [h]) for h in heights])
    hashes = [h for h, err in hash_res if isinstance(h, str) and not err]
    if not hashes:
        return {"blocks": []}

    blocks_by_hash: dict[str, dict[str, Any]] = {}
    missing: list[str] = []
    for h in hashes:
        cached = rpc_client.get_cached_block(h)
        if cached is not None:
            blocks_by_hash[h] = cached
        else:
            missing.append(h)

    if missing:
        fetched = await rpc_client.batch([("getblock", [h, 1]) for h in missing])
        for h, (blk, err) in zip(missing, fetched):
            if isinstance(blk, dict) and not err:
                rpc_client.cache_block(h, blk)
                blocks_by_hash[h] = blk

    points: list[dict[str, Any]] = []
    prev_time: Optional[int] = None
    for h in hashes:
        blk = blocks_by_hash.get(h)
        if not blk:
            continue
        t = int(blk.get("time", 0))
        interval = max(0, t - prev_time) if prev_time is not None else 150
        prev_time = t
        mweb_meta = blk.get("mweb") if isinstance(blk.get("mweb"), dict) else {}
        points.append({
            "height": blk.get("height", 0),
            "time": t,
            "tx_count": blk.get("nTx", len(blk.get("tx", []))),
            "size_kb": round(blk.get("size", 0) / 1000.0, 1),
            "weight": blk.get("weight", 0),
            "interval_s": interval,
            "has_mweb": bool(mweb_meta),
        })
    return {"blocks": points}
