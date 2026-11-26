#!/bin/sh
set -eu

RPC_USER="${RPC_USER:-litecoin}"
RPC_PASSWORD="${RPC_PASSWORD:-litecoin_rpc_secret}"
DB_CACHE="${DB_CACHE:-1024}"
MAX_CONNECTIONS="${MAX_CONNECTIONS:-125}"
MAX_MEMPOOL="${MAX_MEMPOOL:-300}"
PRUNE_MB="${PRUNE_MB:-0}"
SOCKS5_PROXY="${SOCKS5_PROXY:-}"
ONLYNET_ONION="${ONLYNET_ONION:-false}"

set -- \
  -printtoconsole=1 \
  -server=1 \
  -disablewallet=1 \
  -rest=1 \
  -persistmempool=1 \
  -rpcuser="$RPC_USER" \
  -rpcpassword="$RPC_PASSWORD" \
  -rpcport=9332 \
  -rpcbind=0.0.0.0 \
  -rpcallowip=0.0.0.0/0 \
  -rpcworkqueue=128 \
  -zmqpubhashblock=tcp://0.0.0.0:28332 \
  -zmqpubhashtx=tcp://0.0.0.0:28333 \
  -dbcache="$DB_CACHE" \
  -maxconnections="$MAX_CONNECTIONS" \
  -maxmempool="$MAX_MEMPOOL" \
  -listen=1 \
  -bind=0.0.0.0:9333

case "$PRUNE_MB" in
  ""|"0")
    set -- "$@" -txindex=1 -blockfilterindex=1
    ;;
  *)
    if [ "$PRUNE_MB" -gt 0 ] 2>/dev/null; then
      set -- "$@" -prune="$PRUNE_MB"
    else
      set -- "$@" -txindex=1 -blockfilterindex=1
    fi
    ;;
esac

if [ -n "$SOCKS5_PROXY" ]; then
  set -- "$@" -proxy="$SOCKS5_PROXY"
fi

if [ "$ONLYNET_ONION" = "true" ]; then
  set -- "$@" -onlynet=onion
fi

if [ -s /tor-onion/hostname ]; then
  ONION_HOST=$(tr -d ' \t\r\n' < /tor-onion/hostname)
  if [ -n "$ONION_HOST" ]; then
    set -- "$@" -externalip="$ONION_HOST"
  fi
fi

exec /entrypoint.sh "$@"
