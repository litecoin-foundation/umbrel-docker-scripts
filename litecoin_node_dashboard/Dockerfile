FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html

COPY replace-ip.sh /docker-entrypoint.d/replace-ip.sh
RUN chmod +x /docker-entrypoint.d/replace-ip.sh

CMD ["nginx", "-g", "daemon off;"]

