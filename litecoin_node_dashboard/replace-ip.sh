#!/bin/sh

if [ -z "$API_IP" ]; then
    echo "Fehler: API_IP ist nicht gesetzt!"
    exit 1
fi

sed -i "s|{{API_IP}}|$API_IP|g" /usr/share/nginx/html/index.html
