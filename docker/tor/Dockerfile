FROM alpine:3.20

RUN apk add --no-cache tor \
    && mkdir -p /var/lib/tor/litecoin-service /tor-onion \
    && chown -R tor:tor /var/lib/tor

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9050

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
