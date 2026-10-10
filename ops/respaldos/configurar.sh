# Shared rclone setup, sourced by respaldar and restaurar. Everything comes from
# the service environment; passwords are obscured at runtime (rclone format).
: "${RESPALDOS_CLAVE:?Falta RESPALDOS_CLAVE (contraseña de cifrado)}"
: "${RESPALDOS_SAL:?Falta RESPALDOS_SAL (segunda contraseña de cifrado)}"

# No config file: everything is defined by the environment below.
export RCLONE_CONFIG=/dev/null

# The Drive permission as `rclone authorize` prints it. Depending on the rclone
# version and options it is the token JSON ({"access_token":…}) or one or more
# base64 layers around it, wrapped as {"token":…} or {"config_token":…}.
# Unwrap layer by layer until the token itself appears.
desenvolver_base64() {
  relleno=$(printf '%s' "$1" | tr -d '\n\r ' | tr '_-' '/+')
  while [ $((${#relleno} % 4)) -ne 0 ]; do relleno="${relleno}="; done
  printf '%s' "$relleno" | base64 -d 2> /dev/null
}

token_de_drive() {
  valor=$1
  for _ in 1 2 3 4 5; do
    case "$valor" in
      "{"*)
        if printf '%s' "$valor" | jq -e 'has("access_token")' > /dev/null 2>&1; then
          printf '%s' "$valor" | jq -c .
          return 0
        fi
        valor=$(printf '%s' "$valor" |
          jq -er '(.token // .config_token) | if type == "string" then . else tojson end' \
            2> /dev/null) || break
        ;;
      *) valor=$(desenvolver_base64 "$valor") || break ;;
    esac
  done
  echo "El permiso de Google Drive no es válido (repite rclone authorize)" >&2
  return 1
}

# Destination under the encryption layer. Default: the "PJ20-respaldos" folder
# of the authorized Google Drive. A local path is allowed for tests.
destino="${RESPALDOS_DESTINO:-drive:PJ20-respaldos}"
case "$destino" in
  drive:*)
    # PERMISO_DRIVE (preferred) or RCLONE_DRIVE_TOKEN (first setups). The latter
    # must not stay in the environment: rclone reads any RCLONE_DRIVE_* variable
    # as a drive option itself, and would use the still-encoded value as token.
    permiso="${PERMISO_DRIVE:-${RCLONE_DRIVE_TOKEN:-}}"
    unset RCLONE_DRIVE_TOKEN
    [ -n "$permiso" ] || {
      echo "Falta PERMISO_DRIVE (permiso de Google Drive de rclone authorize)" >&2
      exit 1
    }
    export RCLONE_CONFIG_DRIVE_TYPE=drive
    # Least privilege: only the files this service creates, never the rest of the Drive.
    export RCLONE_CONFIG_DRIVE_SCOPE=drive.file
    RCLONE_CONFIG_DRIVE_TOKEN=$(token_de_drive "$permiso") || exit 1
    export RCLONE_CONFIG_DRIVE_TOKEN
    # Deleted backups go away for real (retention), not to the Drive trash.
    export RCLONE_DRIVE_USE_TRASH=false
    ;;
esac

export RCLONE_CONFIG_CIFRADO_TYPE=crypt
export RCLONE_CONFIG_CIFRADO_REMOTE="$destino"
export RCLONE_CONFIG_CIFRADO_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_CIFRADO_DIRECTORY_NAME_ENCRYPTION=true
RCLONE_CONFIG_CIFRADO_PASSWORD="$(rclone obscure "$RESPALDOS_CLAVE")"
RCLONE_CONFIG_CIFRADO_PASSWORD2="$(rclone obscure "$RESPALDOS_SAL")"
export RCLONE_CONFIG_CIFRADO_PASSWORD RCLONE_CONFIG_CIFRADO_PASSWORD2

# Source of the selfies: the private bucket inside the server network.
if [ -n "${S3_ENDPOINT:-}" ]; then
  export RCLONE_CONFIG_FOTOS_TYPE=s3
  export RCLONE_CONFIG_FOTOS_PROVIDER=Other
  export RCLONE_CONFIG_FOTOS_ENDPOINT="$S3_ENDPOINT"
  export RCLONE_CONFIG_FOTOS_ACCESS_KEY_ID="${S3_ACCESS_KEY:?Falta S3_ACCESS_KEY}"
  export RCLONE_CONFIG_FOTOS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:?Falta S3_SECRET_KEY}"
  export RCLONE_CONFIG_FOTOS_FORCE_PATH_STYLE=true
fi
