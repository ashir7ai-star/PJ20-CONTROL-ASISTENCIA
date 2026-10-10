# Shared rclone setup, sourced by respaldar and restaurar. Everything comes from
# the service environment; passwords are obscured at runtime (rclone format).
: "${RESPALDOS_CLAVE:?Falta RESPALDOS_CLAVE (contraseña de cifrado)}"
: "${RESPALDOS_SAL:?Falta RESPALDOS_SAL (segunda contraseña de cifrado)}"

# No config file: everything is defined by the environment below.
export RCLONE_CONFIG=/dev/null

# Destination under the encryption layer. Default: the "PJ20-respaldos" folder
# of the authorized Google Drive. A local path is allowed for tests.
destino="${RESPALDOS_DESTINO:-drive:PJ20-respaldos}"
case "$destino" in
  drive:*)
    : "${RCLONE_DRIVE_TOKEN:?Falta RCLONE_DRIVE_TOKEN (permiso de Google Drive)}"
    export RCLONE_CONFIG_DRIVE_TYPE=drive
    # Least privilege: only the files this service creates, never the rest of the Drive.
    export RCLONE_CONFIG_DRIVE_SCOPE=drive.file
    export RCLONE_CONFIG_DRIVE_TOKEN="$RCLONE_DRIVE_TOKEN"
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
