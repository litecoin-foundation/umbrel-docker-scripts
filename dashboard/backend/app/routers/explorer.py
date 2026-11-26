import re
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from ..rpc import NodeOfflineError, NodeWarmupError, RpcCallError, rpc_client

router = APIRouter(prefix="/api", tags=["explorer"])

HEX64_RE = re.compile(r"^[0-9a-fA-F]{64}$")
LTC_ADDR_RE = re.compile(r"^(ltc1[0-9a-z]{25,90}|ltcmweb1[0-9a-z]{25,120}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,35})$")
GENESIS_TXID = "97ddfbbae6be97fd6cdf3e7ca13232a3afff2353e29badfab7f73011edd4ced9"


def _decode_coinbase_tag(coinbase_hex: str) -> str:
    try:
        raw = bytes.fromhex(coinbase_hex)
        chars = "".join(chr(b) if 32 <= b <= 126 else " " for b in raw)
        parts = [p.strip() for p in chars.split() if len(p.strip()) >= 3]
        return " ".join(parts[:6])
    except Exception:
        return ""


def _guess_miner(tag: str) -> Optional[str]:
    lower = tag.lower()
    known = [
        ("viabtc", "ViaBTC"),
        ("f2pool", "F2Pool"),
        ("antpool", "AntPool"),
        ("binance", "Binance Pool"),
        ("litecoinpool", "LitecoinPool"),
        ("ltc.top", "LTC.TOP"),
        ("poolin", "Poolin"),
        ("mining-dutch", "MiningDutch"),
    ]
    for needle, label in known:
        if needle in lower:
            return label
    return None


@router.get("/blocks")
async def list_blocks(
    limit: int = Query(25, ge=1, le=50),
    start_height: Optional[int] = Query(None, ge=0),
) -> dict[str, Any]:
    try:
        bc = await rpc_client.call("getblockchaininfo")
        tip = int(bc.get("blocks", 0))
    except (NodeOfflineError, NodeWarmupError, RpcCallError) as exc:
        return {"tip_height": 0, "blocks": [], "reason": str(exc)}

    top = min(tip, start_height) if start_height is not None else tip
    heights = list(range(top, max(-1, top - limit), -1))
    if not heights:
        return {"tip_height": tip, "blocks": []}

    hash_res = await rpc_client.batch([("getblockhash", [h]) for h in heights])
    hashes = [h for h, err in hash_res if isinstance(h, str) and not err]
    if not hashes:
        return {"tip_height": tip, "blocks": []}

    blk_res = await rpc_client.batch([("getblock", [h, 1]) for h in hashes])
    blocks: list[dict[str, Any]] = []
    for blk, err in blk_res:
        if isinstance(blk, dict) and not err:
            rpc_client.cache_block(blk["hash"], blk)
            mweb_meta = blk.get("mweb") if isinstance(blk.get("mweb"), dict) else {}
            blocks.append({
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
    return {"tip_height": tip, "blocks": blocks}


@router.get("/block/{height_or_hash}")
async def get_block_detail(height_or_hash: str) -> dict[str, Any]:
    try:
        if height_or_hash.isdigit():
            block_hash = await rpc_client.call("getblockhash", [int(height_or_hash)])
        elif HEX64_RE.match(height_or_hash):
            block_hash = height_or_hash.lower()
        else:
            raise HTTPException(status_code=400, detail="Invalid block height or hash")

        blk = await rpc_client.call("getblock", [block_hash, 2])
    except HTTPException:
        raise
    except RpcCallError as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    raw_txs = blk.get("tx", []) if isinstance(blk.get("tx"), list) else []
    coinbase_tag = ""
    miner = None
    tx_summaries: list[dict[str, Any]] = []

    for idx, tx in enumerate(raw_txs[:50]):
        if not isinstance(tx, dict):
            continue
        vins = tx.get("vin", [])
        vouts = tx.get("vout", [])
        is_cb = idx == 0 and bool(vins and "coinbase" in vins[0])
        if is_cb:
            coinbase_tag = _decode_coinbase_tag(str(vins[0].get("coinbase", "")))
            miner = _guess_miner(coinbase_tag)
        is_hogex = bool(tx.get("mweb")) or (
            len(vouts) > 0 and isinstance(vouts[-1].get("scriptPubKey"), dict) and vouts[-1]["scriptPubKey"].get("type") == "witness_mweb_hogaddr"
        )
        total_out = sum(float(v.get("value", 0.0) or 0.0) for v in vouts)
        tx_summaries.append({
            "txid": tx.get("txid", ""),
            "size": tx.get("size", 0),
            "vsize": tx.get("vsize", tx.get("size", 0)),
            "is_coinbase": is_cb,
            "is_hogex": is_hogex,
            "vin_count": len(vins),
            "vout_count": len(vouts),
            "total_out_ltc": round(total_out, 8),
        })

    mweb_meta = blk.get("mweb") if isinstance(blk.get("mweb"), dict) else {}
    return {
        "block": {
            "height": blk.get("height", 0),
            "hash": blk.get("hash", ""),
            "time": blk.get("time", 0),
            "tx_count": blk.get("nTx", len(raw_txs)),
            "size": blk.get("size", 0),
            "strippedsize": blk.get("strippedsize", 0),
            "weight": blk.get("weight", 0),
            "difficulty": blk.get("difficulty", 0),
            "confirmations": blk.get("confirmations", 0),
            "bits": blk.get("bits", ""),
            "nonce": blk.get("nonce", 0),
            "version_hex": blk.get("versionHex", ""),
            "merkle_root": blk.get("merkleroot", ""),
            "chainwork": blk.get("chainwork", ""),
            "previousblockhash": blk.get("previousblockhash"),
            "nextblockhash": blk.get("nextblockhash"),
            "miner": miner,
            "coinbase_tag": coinbase_tag,
            "has_mweb": bool(mweb_meta),
            "mweb_kernels": len(mweb_meta.get("kernels", [])) if isinstance(mweb_meta.get("kernels"), list) else 0,
            "mweb_outputs": len(mweb_meta.get("outputs", [])) if isinstance(mweb_meta.get("outputs"), list) else 0,
            "txs": tx_summaries,
        },
    }


@router.get("/tx/{txid}")
async def get_tx_detail(txid: str, blockhash: Optional[str] = Query(None)) -> dict[str, Any]:
    txid_l = txid.lower()
    if not HEX64_RE.match(txid_l):
        raise HTTPException(status_code=400, detail="Invalid TXID format")

    bhash_l = blockhash.lower() if blockhash and HEX64_RE.match(blockhash) else None
    tx: Optional[dict[str, Any]] = None
    fallback_blk: Optional[dict[str, Any]] = None

    try:
        params: list[Any] = [txid_l, True]
        if bhash_l:
            params.append(bhash_l)
        tx = await rpc_client.call("getrawtransaction", params)
    except RpcCallError as exc:
        target_bhash = bhash_l
        if not target_bhash and txid_l == GENESIS_TXID:
            try:
                target_bhash = await rpc_client.call("getblockhash", [0])
            except Exception:
                target_bhash = None
        if target_bhash:
            try:
                blk = await rpc_client.call("getblock", [target_bhash, 2])
                for candidate in blk.get("tx", []):
                    if isinstance(candidate, dict) and candidate.get("txid") == txid_l:
                        tx = candidate
                        fallback_blk = blk
                        break
            except Exception:
                pass
        if tx is None:
            raise HTTPException(status_code=404, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    vins_out: list[dict[str, Any]] = []
    vouts_out: list[dict[str, Any]] = []
    is_coinbase = False
    is_mweb = bool(tx.get("mweb"))
    raw_vins = tx.get("vin", [])

    # Resolve previous outputs for up to 15 non-coinbase inputs
    non_cb_vins = [v for v in raw_vins if isinstance(v, dict) and "coinbase" not in v and v.get("txid")]
    prev_txs: dict[str, dict[str, Any]] = {}
    if non_cb_vins:
        unique_prev = list(dict.fromkeys(str(v["txid"]) for v in non_cb_vins[:15]))
        try:
            prev_res = await rpc_client.batch([("getrawtransaction", [ptx, True]) for ptx in unique_prev])
            for ptx_id, (res_obj, err) in zip(unique_prev, prev_res):
                if isinstance(res_obj, dict) and not err:
                    prev_txs[ptx_id] = res_obj
        except Exception:
            pass

    total_in = 0.0
    all_inputs_resolved = len(non_cb_vins) <= 15

    for vin in raw_vins:
        if not isinstance(vin, dict):
            continue
        if "coinbase" in vin:
            is_coinbase = True
            all_inputs_resolved = False
            vins_out.append({
                "txid": "coinbase",
                "vout": 0,
                "address": "Block Reward",
                "value_ltc": None,
                "sequence": vin.get("sequence", 0),
            })
        else:
            prev_id = str(vin.get("txid", ""))
            vout_idx = int(vin.get("vout", 0))
            in_addr = None
            in_val = None
            prev_obj = prev_txs.get(prev_id)
            if prev_obj and isinstance(prev_obj.get("vout"), list):
                for pv in prev_obj["vout"]:
                    if isinstance(pv, dict) and int(pv.get("n", -1)) == vout_idx:
                        in_val = round(float(pv.get("value", 0.0) or 0.0), 8)
                        total_in += in_val
                        pspk = pv.get("scriptPubKey", {}) if isinstance(pv.get("scriptPubKey"), dict) else {}
                        paddrs = pspk.get("addresses") or ([pspk["address"]] if pspk.get("address") else [])
                        in_addr = paddrs[0] if paddrs else pspk.get("type")
                        break
            if in_val is None:
                all_inputs_resolved = False
            vins_out.append({
                "txid": prev_id,
                "vout": vout_idx,
                "address": in_addr,
                "value_ltc": in_val,
                "sequence": vin.get("sequence", 0),
            })

    total_out = 0.0
    for vout in tx.get("vout", []):
        spk = vout.get("scriptPubKey", {}) if isinstance(vout.get("scriptPubKey"), dict) else {}
        addrs = spk.get("addresses") or ([spk["address"]] if spk.get("address") else [])
        spk_type = spk.get("type", "unknown")
        if "mweb" in spk_type:
            is_mweb = True
        val = round(float(vout.get("value", 0.0) or 0.0), 8)
        total_out += val
        vouts_out.append({
            "n": vout.get("n", 0),
            "value_ltc": val,
            "type": spk_type,
            "address": addrs[0] if addrs else spk_type,
        })

    tx_blockhash = tx.get("blockhash") or (fallback_blk.get("hash") if fallback_blk else None)
    confirmations = tx.get("confirmations") if tx.get("confirmations") is not None else (fallback_blk.get("confirmations", 0) if fallback_blk else 0)
    tx_time = tx.get("time") or (fallback_blk.get("time") if fallback_blk else None)
    vsize = int(tx.get("vsize", tx.get("size", 0)) or 0)

    blockheight = fallback_blk.get("height") if fallback_blk else None
    if blockheight is None and tx_blockhash:
        try:
            blk = await rpc_client.get_block_cached(tx_blockhash, 1)
            blockheight = blk.get("height")
        except Exception:
            pass

    fee_ltc: Optional[float] = None
    feerate_lit_vb: Optional[float] = None
    if not tx_blockhash:
        try:
            mp = await rpc_client.call("getmempoolentry", [txid_l])
            if isinstance(mp, dict):
                fees_obj = mp.get("fees") if isinstance(mp.get("fees"), dict) else {}
                base_fee = float(fees_obj.get("base", mp.get("fee", 0.0)) or 0.0)
                fee_ltc = round(base_fee, 8)
                feerate_lit_vb = round((base_fee * 1e8) / max(1, vsize), 2)
        except Exception:
            pass
    elif all_inputs_resolved and non_cb_vins:
        fee_ltc = round(max(0.0, total_in - total_out), 8)
        feerate_lit_vb = round((fee_ltc * 1e8) / max(1, vsize), 2)

    return {
        "tx": {
            "txid": tx.get("txid", txid_l),
            "hash": tx.get("hash", txid_l),
            "version": tx.get("version", 0),
            "size": tx.get("size", 0),
            "vsize": vsize,
            "weight": tx.get("weight", 0),
            "locktime": tx.get("locktime", 0),
            "confirmations": confirmations,
            "blockheight": blockheight,
            "blockhash": tx_blockhash,
            "time": tx_time,
            "is_coinbase": is_coinbase,
            "is_mweb": is_mweb,
            "fee_ltc": fee_ltc,
            "feerate_lit_vb": feerate_lit_vb,
            "vin": vins_out,
            "vout": vouts_out,
        },
    }


@router.get("/address/{address}/utxos")
async def scan_address_utxos(address: str) -> dict[str, Any]:
    addr = address.strip()
    if not LTC_ADDR_RE.match(addr):
        raise HTTPException(status_code=400, detail="Invalid Litecoin address format")

    if addr.startswith("ltcmweb1"):
        raise HTTPException(
            status_code=400,
            detail="MWEB stealth addresses are private by design and cannot be scanned via UTXO set.",
        )

    async with rpc_client.scan_lock:
        try:
            result = await rpc_client.call("scantxoutset", ["start", [f"addr({addr})"]], timeout=60.0)
        except RpcCallError as exc:
            raise HTTPException(status_code=400, detail=exc.message)
        except (NodeOfflineError, NodeWarmupError) as exc:
            raise HTTPException(status_code=503, detail=str(exc))

    unspents = result.get("unspents", []) if isinstance(result, dict) else []
    tip_height = int(result.get("height", 0) or 0) if isinstance(result, dict) else 0
    utxos = [
        {
            "txid": u.get("txid", ""),
            "vout": u.get("vout", 0),
            "amount": float(u.get("amount", 0.0)),
            "height": u.get("height", 0),
            "confirmations": max(0, tip_height - int(u.get("height", 0)) + 1) if tip_height else 0,
            "scriptPubKey": u.get("scriptPubKey", ""),
        }
        for u in unspents[:200]
    ]
    return {
        "address": addr,
        "total_amount_ltc": round(float(result.get("total_amount", 0.0) or 0.0), 8),
        "utxo_count": len(unspents),
        "height": tip_height,
        "utxos": utxos,
    }


@router.get("/search")
async def search_entity(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    query = q.strip()
    if query.isdigit():
        return {"kind": "block", "target": query}
    if LTC_ADDR_RE.match(query):
        return {"kind": "address", "target": query}
    if HEX64_RE.match(query):
        try:
            await rpc_client.call("getblockheader", [query.lower()])
            return {"kind": "block", "target": query.lower()}
        except Exception:
            return {"kind": "tx", "target": query.lower()}
    raise HTTPException(status_code=404, detail="Query did not match a Litecoin block height, hash, TXID, or address")
