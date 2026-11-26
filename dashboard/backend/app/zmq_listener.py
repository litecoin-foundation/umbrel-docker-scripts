import asyncio
import json
import time
from typing import Any, Set

import zmq
import zmq.asyncio
from fastapi import WebSocket

from .config import settings


class WebSocketHub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._clients)
        if not clients:
            return
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        for ws in clients:
            try:
                await asyncio.wait_for(ws.send_text(payload), timeout=2.0)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    self._clients.discard(ws)

    @property
    def client_count(self) -> int:
        return len(self._clients)


ws_hub = WebSocketHub()


async def run_zmq_listener(stop_event: asyncio.Event) -> None:
    ctx = zmq.asyncio.Context()
    last_tx_broadcast = 0.0

    while not stop_event.is_set():
        sock_block = ctx.socket(zmq.SUB)
        sock_tx = ctx.socket(zmq.SUB)
        poller = zmq.asyncio.Poller()
        try:
            sock_block.setsockopt(zmq.RCVTIMEO, 1000)
            sock_block.setsockopt(zmq.LINGER, 0)
            sock_block.connect(settings.zmq_hashblock)
            sock_block.setsockopt(zmq.SUBSCRIBE, b"hashblock")

            sock_tx.setsockopt(zmq.RCVTIMEO, 1000)
            sock_tx.setsockopt(zmq.LINGER, 0)
            sock_tx.connect(settings.zmq_hashtx)
            sock_tx.setsockopt(zmq.SUBSCRIBE, b"hashtx")

            poller.register(sock_block, zmq.POLLIN)
            poller.register(sock_tx, zmq.POLLIN)

            while not stop_event.is_set():
                events = dict(await poller.poll(timeout=1000))
                if sock_block in events:
                    parts = await sock_block.recv_multipart()
                    if len(parts) >= 2:
                        block_hash = parts[1].hex()
                        await ws_hub.broadcast({
                            "type": "new_block",
                            "hash": block_hash,
                            "ts": int(time.time()),
                            "source": "zmq",
                        })
                if sock_tx in events:
                    parts = await sock_tx.recv_multipart()
                    now = time.monotonic()
                    if len(parts) >= 2 and (now - last_tx_broadcast) >= 0.25:
                        last_tx_broadcast = now
                        txid = parts[1].hex()
                        await ws_hub.broadcast({
                            "type": "mempool_tx",
                            "txid": txid,
                            "ts": int(time.time()),
                            "source": "zmq",
                        })
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(3.0)
        finally:
            try:
                sock_block.close(linger=0)
                sock_tx.close(linger=0)
            except Exception:
                pass

    ctx.term()
