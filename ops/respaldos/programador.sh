#!/bin/sh
# Keeps the service alive and runs the backups at fixed Bogotá times (D8):
# database at 02:00, selfies at 03:00. Each runs once per day even if the
# container restarts during that minute.
set -u
echo "Programador de respaldos activo (zona $TZ): base 02:00 · selfies 03:00"
ultima_base=""
ultima_fotos=""
while true; do
  hora=$(date +%H:%M)
  hoy=$(date +%F)
  if [ "$hora" = "02:00" ] && [ "$ultima_base" != "$hoy" ]; then
    ultima_base="$hoy"
    respaldar base || true
  fi
  if [ "$hora" = "03:00" ] && [ "$ultima_fotos" != "$hoy" ]; then
    ultima_fotos="$hoy"
    respaldar fotos || true
  fi
  sleep 20
done
