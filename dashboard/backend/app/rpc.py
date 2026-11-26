import asyncio
import time
from collections import OrderedDict, deque
from typing import Any, Optional

import httpx

from .config import settings


class NodeOfflineError(Exception):
    pass


class NodeWarmupError(Exception):
    pass


class RpcCallError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"RPC Error {code}: {message}")


class LitecoinRPC:
    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._block_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._cache_limit = 500
        self._sync_samples: deque[tuple[float, int, int]] = deque(maxlen=40)
        self._scantxoutset_lock = asyncio.Lock()

    @property
    def base_url(self) -> str:
        return f"http://{settings.rpc_host}:{settings.rpc_port}"

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                auth=(settings.rpc_user, settings.rpc_password),
                timeout=httpx.Timeout(12.0, connect=4.0),
                headers={"content-type": "application/json"},
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def call(self, method: str, params: Optional[list[Any]] = None, timeout: Optional[float] = None) -> Any:
        client = self._get_client()
        payload = {"jsonrpc": "1.0", "id": "ltc-glass", "method": method, "params": params or []}
        try:
            resp = await client.post("/", json=payload, timeout=timeout)
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise NodeOfflineError(str(exc)) from exc

        if resp.status_code == 401:
            raise RpcCallError(-401, "RPC authentication failed (check RPC_USER / RPC_PASSWORD)")

        try:
            data = resp.json()
        except Exception as exc:
            raise NodeOfflineError(f"Invalid RPC response ({resp.status_code})") from exc

        error = data.get("error")
        if error:
            code = int(error.get("code", -1))
            message = str(error.get("message", "Unknown RPC error"))
            if code == -28:
                raise NodeWarmupError(message)
            raise RpcCallError(code, message)

        return data.get("result")

    async def batch(self, calls: list[tuple[str, list[Any]]]) -> list[tuple[Any, Optional[dict[str, Any]]]]:
        if not calls:
            return []
        client = self._get_client()
        payload = [
            {"jsonrpc": "1.0", "id": idx, "method": method, "params": params}
            for idx, (method, params) in enumerate(calls)
        ]
        try:
            resp = await client.post("/", json=payload)
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            raise NodeOfflineError(str(exc)) from exc

        if resp.status_code == 401:
            raise RpcCallError(-401, "RPC authentication failed")

        try:
            items = resp.json()
        except Exception as exc:
            raise NodeOfflineError(f"Invalid batch RPC response ({resp.status_code})") from exc

        if isinstance(items, dict) and items.get("error"):
            err = items["error"]
            if int(err.get("code", -1)) == -28:
                raise NodeWarmupError(str(err.get("message", "Warming up")))
            raise RpcCallError(int(err.get("code", -1)), str(err.get("message", "Batch RPC failed")))

        by_id: dict[int, dict[str, Any]] = {int(item["id"]): item for item in items if "id" in item}
        ordered: list[tuple[Any, Optional[dict[str, Any]]]] = []
        for idx in range(len(calls)):
            item = by_id.get(idx, {})
            err = item.get("error")
            if err and int(err.get("code", -1)) == -28:
                raise NodeWarmupError(str(err.get("message", "Warming up")))
            ordered.append((item.get("result"), err))
        return ordered

    def get_cached_block(self, block_hash: str) -> Optional[dict[str, Any]]:
        block = self._block_cache.get(block_hash)
        if block is not None:
            self._block_cache.move_to_end(block_hash)
        return block

    def cache_block(self, block_hash: str, block: dict[str, Any]) -> None:
        if int(block.get("confirmations", 0)) < 6:
            return
        self._block_cache[block_hash] = block
        self._block_cache.move_to_end(block_hash)
        while len(self._block_cache) > self._cache_limit:
            self._block_cache.popitem(last=False)

    async def get_block_cached(self, block_hash: str, verbosity: int = 1) -> dict[str, Any]:
        if verbosity == 1:
            cached = self.get_cached_block(block_hash)
            if cached is not None:
                return cached
        block = await self.call("getblock", [block_hash, verbosity])
        if verbosity == 1 and isinstance(block, dict):
            self.cache_block(block_hash, block)
        return block

    def record_sync_sample(self, blocks: int, headers: int, network_tip: int) -> dict[str, Any]:
        now = time.time()
        self._sync_samples.append((now, blocks, headers))
        blocks_per_sec = 0.0
        headers_per_sec = 0.0
        eta_seconds: Optional[int] = None

        if len(self._sync_samples) >= 2:
            t0, b0, h0 = self._sync_samples[0]
            dt = now - t0
            if dt > 1.0:
                db = blocks - b0
                dh = headers - h0
                if db > 0:
                    blocks_per_sec = round(db / dt, 2)
                if dh > 0:
                    headers_per_sec = round(dh / dt, 1)

        target_blocks = max(headers, network_tip)
        if blocks == 0 and network_tip > 0 and headers < network_tip:
            sync_stage = "headers"
            if headers_per_sec > 0:
                eta_seconds = int((network_tip - headers) / headers_per_sec)
        elif target_blocks > 0 and blocks < target_blocks - 2:
            sync_stage = "blocks"
            if blocks_per_sec > 0:
                eta_seconds = int((target_blocks - blocks) / blocks_per_sec)
        else:
            sync_stage = "synced"
            eta_seconds = 0

        if network_tip > 0:
            header_progress = round(min(100.0, (headers / network_tip) * 100.0), 1)
        else:
            header_progress = 100.0 if headers > 0 else 0.0

        return {
            "sync_stage": sync_stage,
            "blocks_per_sec": blocks_per_sec,
            "headers_per_sec": headers_per_sec,
            "header_progress": header_progress,
            "eta_seconds": eta_seconds,
        }

    @property
    def scan_lock(self) -> asyncio.Lock:
        return self._scantxoutset_lock


rpc_client = LitecoinRPC()
