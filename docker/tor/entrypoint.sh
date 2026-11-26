#!/bin/sh
set -eu

mkdir -p /var/lib/tor/litecoin-service /tor-onion
chown -R tor:tor /var/lib/tor
chmod 700 /var/lib/tor /var/lib/tor/litecoin-service

cat <<EOF > /etc/tor/torrc
User tor
DataDirectory /var/lib/tor
SocksPort 0.0.0.0:9050
HiddenServiceDir /var/lib/tor/litecoin-service
HiddenServiceVersion 3
HiddenServicePort 9333 litecoind:9333
Log notice stdout
EOF

# Background watcher copies the generated v3 .onion hostname into the shared volume
(
  i=0
  while [ "$i" -lt 60 ]; do
    if [ -s /var/lib/tor/litecoin-service/hostname ]; then
      cp /var/lib/tor/litecoin-service/hostname /tor-onion/hostname
      chmod 644 /tor-onion/hostname
      echo "[tor-sidecar] Published onion hostname: $(cat /tor-onion/hostname)"
      break
    fi
    i=$((i + 1))
    sleep 1
  done
) &

exec tor -f /etc/tor/torrc
