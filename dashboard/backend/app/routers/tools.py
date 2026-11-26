from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import require_admin
from ..config import read_onion_hostname, settings
from ..rpc import NodeOfflineError, NodeWarmupError, RpcCallError, rpc_client

router = APIRouter(prefix="/api", tags=["tools"])

RPC_CATALOG = [
    {"method": "getblockchaininfo", "hint": "Chain state, sync progress, softforks, disk size"},
    {"method": "getnetworkinfo", "hint": "Node version, connections, local addresses"},
    {"method": "getmempoolinfo", "hint": "Mempool TX count, byte usage, min relay fee"},
    {"method": "getmininginfo", "hint": "Difficulty, network hashrate, block template info"},
    {"method": "getpeerinfo", "hint": "Detailed telemetry for all connected peers"},
    {"method": "getnettotals", "hint": "Cumulative bytes sent/received"},
    {"method": "estimatesmartfee", "hint": "Fee rate estimate, e.g. [6]"},
    {"method": "getblockcount", "hint": "Current best block height"},
    {"method": "getbestblockhash", "hint": "Hash of current chain tip"},
    {"method": "getblockhash", "hint": "Get hash by height, e.g. [100]"},
    {"method": "getblock", "hint": "Inspect block by hash, e.g. [\"<hash>\", 1]"},
    {"method": "uptime", "hint": "Daemon uptime in seconds"},
]

SAFE_MODE_BLOCKED = {"stop", "backupwallet", "dumpprivkey", "dumpwallet", "encryptwallet"}


class RpcExecRequest(BaseModel):
    method: str
    params: list[Any] = []
    safe_mode: bool = True


class PeerAddRequest(BaseModel):
    node: str
    command: str = "onetry"


class PeerDisconnectRequest(BaseModel):
    address: str


class PeerBanRequest(BaseModel):
    subnet: str
    command: str = "add"
    bantime: int = 86400


class TxHexRequest(BaseModel):
    hexstring: str


class VerifyMessageRequest(BaseModel):
    address: str
    signature: str
    message: str


@router.get("/rpc/help")
async def rpc_help() -> dict[str, Any]:
    return {"commands": RPC_CATALOG}


@router.post("/rpc/exec", dependencies=[Depends(require_admin)])
async def exec_rpc(req: RpcExecRequest) -> dict[str, Any]:
    method = req.method.strip().lower()
    if not method:
        raise HTTPException(status_code=400, detail="RPC method name required")
    if req.safe_mode and method in SAFE_MODE_BLOCKED:
        raise HTTPException(
            status_code=403,
            detail=f"Method '{method}' is blocked while Safe Mode is enabled.",
        )

    try:
        result = await rpc_client.call(method, req.params)
        return {"method": method, "result": result}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=f"RPC {exc.code}: {exc.message}")
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/peers/add", dependencies=[Depends(require_admin)])
async def add_peer(req: PeerAddRequest) -> dict[str, Any]:
    cmd = req.command if req.command in ("add", "remove", "onetry") else "onetry"
    try:
        await rpc_client.call("addnode", [req.node.strip(), cmd])
        return {"ok": True, "node": req.node.strip(), "command": cmd}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/peers/disconnect", dependencies=[Depends(require_admin)])
async def disconnect_peer(req: PeerDisconnectRequest) -> dict[str, Any]:
    try:
        await rpc_client.call("disconnectnode", [req.address.strip()])
        return {"ok": True, "address": req.address.strip()}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/peers/ban", dependencies=[Depends(require_admin)])
async def ban_peer(req: PeerBanRequest) -> dict[str, Any]:
    cmd = req.command if req.command in ("add", "remove") else "add"
    try:
        await rpc_client.call("setban", [req.subnet.strip(), cmd, req.bantime])
        return {"ok": True, "subnet": req.subnet.strip(), "command": cmd, "bantime": req.bantime}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/tx/decode")
async def decode_tx(req: TxHexRequest) -> dict[str, Any]:
    raw_hex = req.hexstring.strip()
    if not raw_hex:
        raise HTTPException(status_code=400, detail="Transaction hex is required")
    try:
        decoded = await rpc_client.call("decoderawtransaction", [raw_hex])
        return {"decoded": decoded}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/tx/broadcast", dependencies=[Depends(require_admin)])
async def broadcast_tx(req: TxHexRequest) -> dict[str, Any]:
    raw_hex = req.hexstring.strip()
    if not raw_hex:
        raise HTTPException(status_code=400, detail="Transaction hex is required")
    try:
        txid = await rpc_client.call("sendrawtransaction", [raw_hex])
        return {"ok": True, "txid": txid}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/message/verify")
async def verify_message(req: VerifyMessageRequest) -> dict[str, Any]:
    try:
        valid = await rpc_client.call("verifymessage", [req.address.strip(), req.signature.strip(), req.message])
        return {"valid": bool(valid)}
    except RpcCallError as exc:
        raise HTTPException(status_code=400, detail=exc.message)
    except (NodeOfflineError, NodeWarmupError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/config/generator")
async def get_config_snippet(
    pruned: bool = Query(False),
    prune_mb: int = Query(10000, ge=550, le=500000),
    tor_proxy: bool = Query(False),
    db_cache: int = Query(1024, ge=128, le=16384),
) -> dict[str, Any]:
    onion_host = read_onion_hostname()
    lines = [
        "# Generated by Litecoin Node Glass Suite",
        "server=1",
        "disablewallet=1",
        "rest=1",
        f"dbcache={db_cache}",
        f"maxconnections={settings.max_connections}",
        f"maxmempool={settings.max_mempool}",
        "persistmempool=1",
        "zmqpubhashblock=tcp://0.0.0.0:28332",
        "zmqpubhashtx=tcp://0.0.0.0:28333",
    ]
    if pruned:
        lines.append(f"prune={prune_mb}")
    else:
        lines.extend(["txindex=1", "blockfilterindex=1"])
    if tor_proxy:
        lines.extend(["proxy=tor:9050", "listen=1"])
    return {
        "litecoin_conf": "\n".join(lines),
        "p2p_port": settings.p2p_port,
        "onion_host": onion_host,
    }
