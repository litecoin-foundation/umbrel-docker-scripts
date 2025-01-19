# Basis-Image: nginx
FROM nginx:alpine

# HTML-Datei hinzufügen
COPY index.html /usr/share/nginx/html/index.html

# Skript hinzufügen, um die IP zu ersetzen
COPY replace-ip.sh /docker-entrypoint.d/replace-ip.sh
RUN chmod +x /docker-entrypoint.d/replace-ip.sh

# Nginx starten
CMD ["nginx", "-g", "daemon off;"]

