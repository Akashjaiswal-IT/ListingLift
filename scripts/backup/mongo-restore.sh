#!/usr/bin/env bash
# Restore a PLAIN (already decrypted) Peshkar AI backup archive into the MongoDB container.
# THIS REPLACES THE CURRENT DATABASE CONTENTS. Read docs/runbooks/database-backups.md first.
#
# Run on the server from the repo root (it reads the root login from .env.production):
#   sudo bash scripts/backup/mongo-restore.sh /var/backups/peshkar/local/peshkar-mongo-<time>.archive.gz
#   sudo bash scripts/backup/mongo-restore.sh <archive> --app-db-only   # see below
#
# Default (recommended): full point-in-time restore of every database, including the admin
# database (database users). Uses mongorestore --oplogReplay, so the result is exactly the
# moment the dump finished. Database user passwords go back to what they were at that time.
#
# --app-db-only: restore only the app database (MONGO_DB, default peshkar) and leave the admin
# database (users/passwords) alone. MongoDB does not allow --oplogReplay together with a
# database filter, so writes made during the few seconds of the dump may be missing.
#
# Add --yes to skip the typed confirmation (for scripted use only).
set -Eeuo pipefail
umask 077

ARCHIVE="${1:-}"
shift || true
APP_DB_ONLY=0
ASSUME_YES=0
for a in "$@"; do
  case "$a" in
    --app-db-only) APP_DB_ONLY=1 ;;
    --yes) ASSUME_YES=1 ;;
    *) echo "Unknown option: $a"; exit 2 ;;
  esac
done

APP_ENV="${APP_ENV:-.env.production}"
BACKUP_ENV="${ENV_FILE:-/etc/peshkar-backup/backup.env}"
DOCKER="${DOCKER:-docker}"

get_val() { # value of KEY in FILE, surrounding quotes and Windows line endings removed
  local v
  [ -f "$1" ] || return 0
  v=$(grep -E "^$2=" "$1" | head -1 | cut -d= -f2- || true)
  v=${v%$'\r'}
  if [[ $v =~ ^\"(.*)\"$ ]] || [[ $v =~ ^\'(.*)\'$ ]]; then v=${BASH_REMATCH[1]}; fi
  printf '%s' "$v"
}

[ -n "$ARCHIVE" ] || { echo "Usage: $0 <plain archive .archive.gz> [--app-db-only] [--yes]"; exit 2; }
[ -f "$ARCHIVE" ] || { echo "File not found: $ARCHIVE"; exit 1; }
case "$ARCHIVE" in
  *.age) echo "This file is still encrypted (.age). Decrypt it first on your own computer (see the runbook)."; exit 1 ;;
esac
[ -f "$APP_ENV" ] || { echo "Missing $APP_ENV (run from the repo root on the server)"; exit 1; }

MU=$(get_val "$APP_ENV" MONGO_INITDB_ROOT_USERNAME)
MP=$(get_val "$APP_ENV" MONGO_INITDB_ROOT_PASSWORD)
[ -n "$MU" ] && [ -n "$MP" ] || { echo "MONGO_INITDB_ROOT_USERNAME/PASSWORD not found in $APP_ENV"; exit 1; }
CONTAINER="${MONGO_CONTAINER:-$(get_val "$BACKUP_ENV" MONGO_CONTAINER)}"
CONTAINER="${CONTAINER:-peshkar-mongodb}"
MONGO_DB="${MONGO_DB:-$(get_val "$BACKUP_ENV" MONGO_DB)}"
MONGO_DB="${MONGO_DB:-peshkar}"
[[ $MONGO_DB =~ ^[A-Za-z0-9_-]+$ ]] || { echo "MONGO_DB has unexpected characters"; exit 1; }

# If the manifest sits next to the archive, check the checksum first.
MANIFEST="${ARCHIVE%.archive.gz}.manifest.json"
if [ -f "$MANIFEST" ] && command -v jq >/dev/null && command -v sha256sum >/dev/null; then
  want=$(jq -r '.archiveSha256 // empty' "$MANIFEST")
  got=$(sha256sum -- "$ARCHIVE" | awk '{ print $1 }')
  if [ -n "$want" ] && [ "$want" != "$got" ]; then
    echo "Checksum does NOT match $MANIFEST: the archive is damaged. Pick another one."; exit 1
  fi
  echo "Checksum OK (matches $(basename -- "$MANIFEST"))."
fi

[ "$("$DOCKER" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" = "true" ] \
  || { echo "Container $CONTAINER is not running."; exit 1; }

echo
echo "About to restore:  $ARCHIVE ($(du -h -- "$ARCHIVE" | cut -f1))"
echo "Into container:    $CONTAINER"
if [ "$APP_DB_ONLY" = 1 ]; then
  echo "Mode:              app database '$MONGO_DB' only (no oplog replay; admin users untouched)"
else
  echo "Mode:              full point-in-time restore (all databases, --oplogReplay)"
fi
echo "Collections in the backup REPLACE the current ones (--drop). Data written after the"
echo "backup time is lost. Stop the app first so nothing writes during the restore:"
echo "  docker compose -f docker-compose.server.yml stop api-service worker"
if [ "$ASSUME_YES" != 1 ]; then
  read -r -p "Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || { echo "Cancelled. Nothing was changed."; exit 1; }
fi

# Password goes to mongorestore through a file descriptor as a one-line YAML config.
export MU MONGO_DB APP_DB_ONLY
export MTOOLCFG="password: '${MP//\'/\'\'}'"
"$DOCKER" exec -i -e MU -e MTOOLCFG -e MONGO_DB -e APP_DB_ONLY "$CONTAINER" bash -c '
  set -e
  if [ "$APP_DB_ONLY" = 1 ]; then mode=(--nsInclude="${MONGO_DB}.*"); else mode=(--oplogReplay); fi
  mongorestore --config=<(printf "%s\n" "$MTOOLCFG") --host=127.0.0.1 --port=27017 \
    --username="$MU" --authenticationDatabase=admin \
    --archive --gzip --drop --stopOnError "${mode[@]}"
' < "$ARCHIVE"

echo
echo "Restore finished. Start the app again:"
echo "  docker compose -f docker-compose.server.yml start api-service worker"
