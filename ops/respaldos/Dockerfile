# syntax=docker/dockerfile:1
# Off-server backups (D8): pg_dump (same major version as the database) +
# rclone, encrypted with rclone crypt before anything leaves the server.
# Build context: repository root  →  docker build -f ops/respaldos/Dockerfile .
FROM postgres:18-alpine

RUN apk add --no-cache rclone tini tzdata jq && install -d -m 0755 /app
ENV TZ=America/Bogota

COPY --chmod=0644 ops/respaldos/configurar.sh /app/configurar.sh
COPY --chmod=0755 ops/respaldos/respaldar.sh /app/respaldar
COPY --chmod=0755 ops/respaldos/restaurar.sh /app/restaurar
COPY --chmod=0755 ops/respaldos/programador.sh /app/programador
ENV PATH="/app:${PATH}"

# Never as root (CLAUDE.md §7.1): the image's own unprivileged user.
USER postgres
WORKDIR /tmp
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["programador"]
