#!/bin/sh
# One backup run (D8). Usage: respaldar [base|fotos|todo]   (default: todo)
#   base  → pg_dump, verified, encrypted to base/diaria (+ base/mensual on day 1)
#   fotos → encrypted mirror of the selfies bucket (retention deletions follow)
# Every run records its result in backup_runs; the admin panel shows it.
set -eu
. /app/configurar.sh
: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL (usuario de respaldos)}"

registrar() { # kind ok detail
  printf "INSERT INTO backup_runs (kind, ok, detail) VALUES (:'kind', :'ok'::boolean, :'detail');\n" |
    psql "$BACKUP_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -v kind="$1" -v ok="$2" -v detail="$3" ||
    echo "✗ No se pudo registrar el resultado ($1)" >&2
}

# Each step checks its own result: these functions run inside a command
# substitution, where "set -e" does not apply, so a failure must never pass silently.
respaldar_base() {
  fecha=$(date +%F)
  archivo="/tmp/pj20-$fecha.dump"
  pg_dump --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" \
    --file="$archivo" || return 1
  # A dump that cannot be read back is not a backup: verify before uploading.
  pg_restore --list "$archivo" > /dev/null || { rm -f "$archivo"; return 1; }
  tamano=$(du -k "$archivo" | cut -f1)
  rclone copyto "$archivo" "cifrado:base/diaria/pj20-$fecha.dump" || { rm -f "$archivo"; return 1; }
  if [ "$(date +%d)" = "01" ]; then
    rclone copyto "$archivo" "cifrado:base/mensual/pj20-$(date +%Y-%m).dump" || {
      rm -f "$archivo"
      return 1
    }
    rclone delete "cifrado:base/mensual" --min-age 370d || return 1
    registrar db-monthly true "${tamano} KB"
  fi
  rm -f "$archivo"
  rclone delete "cifrado:base/diaria" --min-age 35d || return 1
  registrar db-daily true "${tamano} KB"
  echo "✓ Base de datos respaldada (${tamano} KB, cifrada)"
}

respaldar_fotos() {
  [ -n "${S3_BUCKET:-}" ] || { echo "Falta S3_BUCKET"; return 1; }
  rclone sync "fotos:$S3_BUCKET" "cifrado:fotos" --fast-list || return 1
  total=$(rclone size "cifrado:fotos" --json 2> /dev/null | sed -n 's/.*"count":\([0-9]*\).*/\1/p') || return 1
  registrar selfies true "${total:-0} archivos"
  echo "✓ Selfies respaldadas (${total:-0} archivos, cifradas)"
}

intentar() { # kind function
  if salida=$("$2" 2>&1); then
    echo "$salida"
    return 0
  fi
  ultima=$(printf '%s\n' "$salida" | tail -n 1 | cut -c1-300)
  registrar "$1" false "$ultima"
  echo "✗ Falló ($1): $ultima" >&2
  return 1
}

que="${1:-todo}"
estado=0
case "$que" in
  base) intentar db-daily respaldar_base || estado=1 ;;
  fotos) intentar selfies respaldar_fotos || estado=1 ;;
  todo)
    intentar db-daily respaldar_base || estado=1
    intentar selfies respaldar_fotos || estado=1
    ;;
  *)
    echo "Uso: respaldar [base|fotos|todo]" >&2
    exit 2
    ;;
esac
exit "$estado"
