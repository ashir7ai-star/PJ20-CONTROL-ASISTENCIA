#!/bin/sh
# Recovery (D8). See docs/deploy/RESPALDOS.md before using it.
#   restaurar listar                 → available database copies
#   restaurar base <archivo> <url>   → restores that copy INTO <url> (use a temporary database first!)
#   restaurar fotos                  → copies the selfies back into the bucket
set -eu
. /app/configurar.sh

case "${1:-}" in
  listar)
    echo "Copias diarias:"; rclone lsf "cifrado:base/diaria" | sort
    echo "Copias mensuales:"; rclone lsf "cifrado:base/mensual" 2> /dev/null | sort || true
    ;;
  base)
    archivo="${2:?Indica el archivo, por ejemplo diaria/pj20-2026-10-10.dump}"
    destino="${3:?Indica la URL de la base de datos donde restaurar}"
    rclone copyto "cifrado:base/$archivo" /tmp/restaurar.dump
    pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error \
      --dbname="$destino" /tmp/restaurar.dump
    rm -f /tmp/restaurar.dump
    echo "✓ Copia $archivo restaurada. Verifica con: node dist/contar-registros.js <url>"
    ;;
  fotos)
    : "${S3_BUCKET:?Falta S3_BUCKET}"
    rclone copy "cifrado:fotos" "fotos:$S3_BUCKET"
    echo "✓ Selfies copiadas de vuelta al almacenamiento"
    ;;
  *) echo "Uso: restaurar listar | base <archivo> <url> | fotos" >&2; exit 2 ;;
esac
