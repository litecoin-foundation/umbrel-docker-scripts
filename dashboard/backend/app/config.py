import os
import secrets
from dataclasses import dataclass, field
from typing import Optional


def _parse_bool(val: Optional[str], default: bool = False) -> bool:
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    rpc_host: str = os.getenv("RPC_HOST", "litecoind")
    rpc_port: int = int(os.getenv("RPC_PORT", "9332"))
    rpc_user: str = os.getenv("RPC_USER", "litecoin")
    rpc_password: str = os.getenv("RPC_PASSWORD", "litecoin_rpc_secret")
    zmq_hashblock: str = os.getenv("ZMQ_HASHBLOCK", "tcp://litecoind:28332")
    zmq_hashtx: str = os.getenv("ZMQ_HASHTX", "tcp://litecoind:28333")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "litecoin-admin")
    lock_entire_dashboard: bool = _parse_bool(os.getenv("LOCK_ENTIRE_DASHBOARD"), False)
    external_proxy: str = os.getenv("EXTERNAL_PROXY", "").strip()
    prune_mb: int = int(os.getenv("PRUNE_MB", "0") or "0")
    db_cache: int = int(os.getenv("DB_CACHE", "1024") or "1024")
    max_connections: int = int(os.getenv("MAX_CONNECTIONS", "125") or "125")
    max_mempool: int = int(os.getenv("MAX_MEMPOOL", "300") or "300")
    p2p_port: int = int(os.getenv("LITECOIN_P2P_PORT", "9333") or "9333")
    tor_onion_file: str = os.getenv("TOR_ONION_FILE", "/tor-onion/hostname")


@dataclass
class RuntimeState:
    enable_price_ticker: bool = False
    enable_geoip: bool = False
    session_secret: bytes = field(default_factory=lambda: secrets.token_bytes(32))


settings = Settings()
runtime_state = RuntimeState()


def read_onion_hostname() -> Optional[str]:
    try:
        if os.path.exists(settings.tor_onion_file):
            with open(settings.tor_onion_file, "r", encoding="utf-8") as fh:
                host = fh.read().strip()
                if host:
                    return host
    except OSError:
        pass
    return None
