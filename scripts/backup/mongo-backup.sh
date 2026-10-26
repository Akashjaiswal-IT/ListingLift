#!/usr/bin/env bash
# Peshkar AI - hourly MongoDB backup.
#
# What one run does (systemd runs it every hour, see scripts/backup/systemd/):
#   1. Loads settings from /etc/peshkar-backup/backup.env (override with ENV_FILE=...).
#   2. Refuses to run if the root disk is 90% full or more.
#   3. Counts documents in a few key collections (the "manifest"), right before the dump.
#   4. Runs `mongodump --oplog --gzip --archive` inside the Mongo container as the
#      least-privilege backup user, and keeps a plain local copy (mode 0600). Only the newest
#      KEEP_LOCAL (24) local copies are kept.
#   5. Encrypts the archive and manifest with age (PUBLIC key only) and uploads them to
#      Cloudflare R2 under mongodump/hourly/YYYY/MM/DD/. Once a day it also uploads them to
#      mongodump/daily/YYYY/MM/ plus an encrypted tarball of .env.production + mongo-keyfile
#      to config/YYYY/MM/.
#   6. Pings Healthchecks.io: /start, then success or /fail. A failed ping never fails the backup.
#
# Full guide: docs/runbooks/database-backups.md
# Manual run on the server:  sudo systemctl start peshkar-mongo-backup.service
# Debug run (same thing, output in the terminal):  sudo /usr/local/sbin/peshkar-mongo-backup
#
# Secrets are never passed on a command line (other users can see command lines in `ps`):
# they travel as environment variables (docker exec -e NAME with no value copies it from our
# environment) or through a file descriptor.

set -Eeuo pipefail
umask 077
export LC_ALL=C

ENV_FILE="${ENV_FILE:-/etc/peshkar-backup/backup.env}"
RUN_ID=""
FAIL_REASON=""
SUCCESS_SENT=0
STEP="starting"
WORK_FILES=()

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

die() {
  FAIL_REASON="$*"
  log "ERROR: $*"
  exit 1
}

# ---------------------------------------------------------------- Healthchecks.io
hc_ping() { # $1 = "" (success) | "/start" | "/fail"   $2 = short message (sent as the ping body)
  [ -n "${HC_PING_URL:-}" ] || return 0
  local url="${HC_PING_URL%/}${1}"
  [ -n "$RUN_ID" ] && url="${url}?rid=${RUN_ID}"
  curl -fsS -m 10 --retry 3 --retry-delay 2 -o /dev/null --data-raw "${2:-}" "$url" >/dev/null 2>&1 \
    || log "warning: Healthchecks.io ping failed (ignored; the backup itself is not affected)"
  return 0
}

# ---------------------------------------------------------------- traps
on_error() { # runs on any failing command (ERR trap); the EXIT trap then reports it
  local rc=$1 line=$2 cmd=$3
  trap - ERR
  # BASH_COMMAND is the command as written in this file (before expansion), so no secrets.
  [ -n "$FAIL_REASON" ] || FAIL_REASON="step '${STEP}' failed (line ${line}, exit ${rc}): ${cmd}"
  log "ERROR: ${FAIL_REASON}"
  exit "$rc"
}

on_exit() {
  local rc=$?
  local f
  for f in "${WORK_FILES[@]+"${WORK_FILES[@]}"}"; do rm -f -- "$f"; done
  if [ "$rc" -ne 0 ] && [ "$SUCCESS_SENT" -eq 0 ]; then
    [ -n "$FAIL_REASON" ] || FAIL_REASON="step '${STEP}' failed (exit ${rc})"
    hc_ping /fail "$(hostname) peshkar-mongo-backup FAILED: ${FAIL_REASON}"
  fi
}

trap 'on_error $? $LINENO "$BASH_COMMAND"' ERR
trap on_exit EXIT
trap 'FAIL_REASON="interrupted by a signal"; exit 130' INT TERM

# ---------------------------------------------------------------- settings
# Safe KEY=value reader: the file is never executed as shell code, so passwords may contain
# any character. Values already set in the environment win (handy for testing).
# Only RCLONE_* variables are exported (rclone reads its R2 settings from them); everything else
# stays a plain shell variable that child processes do not see.
load_env_file() {
  local f=$1 line key val n=0
  [ -f "$f" ] && [ -r "$f" ] || die "settings file $f not found or not readable (see backup.env.example)"
  local mode
  mode=$(stat -c '%a' "$f")
  if (( (8#$mode & 8#077) != 0 )); then
    die "settings file $f is readable by other users (mode $mode); fix with: chmod 600 $f"
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
    if [[ $line =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key=${BASH_REMATCH[2]}
      val=${BASH_REMATCH[3]}
      if [[ $val =~ ^\"(.*)\"$ ]] || [[ $val =~ ^\'(.*)\'$ ]]; then val=${BASH_REMATCH[1]}; fi
      if [ -z "${!key+x}" ]; then printf -v "$key" '%s' "$val"; fi
      if [[ $key == RCLONE_* ]]; then export "${key?}"; fi
    else
      # Do not print the line itself: it may contain a secret.
      die "line $n of $f is not in KEY=value form"
    fi
  done < "$f"
}

require() { # require VAR_NAME...  (never prints the value)
  local v
  for v in "$@"; do
    [ -n "${!v:-}" ] || die "setting $v is empty or missing in $ENV_FILE"
  done
}

STEP="loading settings"
load_env_file "$ENV_FILE"

LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/var/backups/peshkar/local}"
WORK_DIR="${WORK_DIR:-/var/backups/peshkar/work}"
KEEP_LOCAL="${KEEP_LOCAL:-24}"
DISK_CHECK_PATH="${DISK_CHECK_PATH:-/}"
DISK_MAX_USED_PCT="${DISK_MAX_USED_PCT:-90}"
DOCKER="${DOCKER:-docker}"
MONGO_CONTAINER="${MONGO_CONTAINER:-peshkar-mongodb}"
MONGO_DB="${MONGO_DB:-peshkar}"
MONGO_BACKUP_USER="${MONGO_BACKUP_USER:-peshkar_backup}"
MANIFEST_COLLECTIONS="${MANIFEST_COLLECTIONS:-users creditledgers payments listingobjects}"
MIN_ARCHIVE_BYTES="${MIN_ARCHIVE_BYTES:-1024}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"
DAILY_UTC_HOUR="${DAILY_UTC_HOUR:-21}"
CONFIG_FILES="${CONFIG_FILES:-.env.production mongo-keyfile}"
FORCE_DAILY="${FORCE_DAILY:-0}"

require MONGO_BACKUP_PASSWORD AGE_RECIPIENT R2_BUCKET APP_DIR
[ -n "${HC_PING_URL:-}" ] || log "warning: HC_PING_URL is empty, so nobody will be alerted if backups stop"

for v in KEEP_LOCAL DISK_MAX_USED_PCT MIN_ARCHIVE_BYTES DAILY_UTC_HOUR; do
  [[ ${!v} =~ ^[0-9]+$ ]] || die "setting $v must be a whole number"
done
(( KEEP_LOCAL >= 1 )) || die "KEEP_LOCAL must be at least 1"
(( 10#$DAILY_UTC_HOUR <= 23 )) || die "DAILY_UTC_HOUR must be 0-23"
[[ $MONGO_DB =~ ^[A-Za-z0-9_-]+$ ]] || die "MONGO_DB has unexpected characters"

remote_upper=$(printf '%s' "$RCLONE_REMOTE" | tr 'a-z-' 'A-Z_')
remote_type_var="RCLONE_CONFIG_${remote_upper}_TYPE"
[ -n "${!remote_type_var:-}" ] || die "rclone remote '$RCLONE_REMOTE' is not configured ($remote_type_var is missing)"

# age recipients: one or more public keys separated by spaces or commas.
AGE_ARGS=()
for r in ${AGE_RECIPIENT//,/ }; do
  [[ $r == age1* ]] || die "AGE_RECIPIENT must contain age PUBLIC keys starting with age1 (never the private AGE-SECRET-KEY)"
  AGE_ARGS+=(-r "$r")
done
(( ${#AGE_ARGS[@]} > 0 )) || die "AGE_RECIPIENT is empty"

STEP="checking tools"
for tool in "$DOCKER" age rclone jq curl flock sha256sum tar gzip df stat find; do
  command -v "$tool" >/dev/null 2>&1 || die "required program '$tool' is not installed"
done

RUN_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || true)
hc_ping /start "$(hostname) backup starting"

NOW=$(date -u +%s)
STAMP=$(date -u -d "@$NOW" +%Y%m%dT%H%M%SZ)
Y=$(date -u -d "@$NOW" +%Y)
M=$(date -u -d "@$NOW" +%m)
D=$(date -u -d "@$NOW" +%d)
TODAY=$(date -u -d "@$NOW" +%F)
HOUR=$(date -u -d "@$NOW" +%H)
BASE="peshkar-mongo-${STAMP}"
ARCHIVE_NAME="${BASE}.archive.gz"
MANIFEST_NAME="${BASE}.manifest.json"
REMOTE="${RCLONE_REMOTE}:${R2_BUCKET}"

# ---------------------------------------------------------------- preparation
STEP="preparing folders"
mkdir -p -- "$LOCAL_BACKUP_DIR" "$WORK_DIR"
chmod 700 -- "$LOCAL_BACKUP_DIR" "$WORK_DIR"

exec 9>"$WORK_DIR/.lock"
flock -n 9 || die "another backup run is still in progress"

# Leftovers from a run that crashed (e.g. power loss).
find "$WORK_DIR" -maxdepth 1 -type f \( -name '*.age' -o -name '*.tmp' \) -delete
find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type f -name '.*.partial' -delete

STEP="checking free disk space"
used_pct=$(df -P -- "$DISK_CHECK_PATH" | awk 'NR==2 { gsub("%", "", $5); print $5 }')
[[ $used_pct =~ ^[0-9]+$ ]] || die "could not read disk usage of $DISK_CHECK_PATH"
if (( used_pct >= DISK_MAX_USED_PCT )); then
  die "disk $DISK_CHECK_PATH is ${used_pct}% full (limit ${DISK_MAX_USED_PCT}%); free some space"
fi
log "disk $DISK_CHECK_PATH ${used_pct}% used"

STEP="checking the Mongo container"
running=$("$DOCKER" inspect -f '{{.State.Running}}' "$MONGO_CONTAINER" 2>/dev/null || true)
[ "$running" = "true" ] || die "container $MONGO_CONTAINER is not running"

# Runs a command inside the Mongo container with the backup user's credentials in the
# environment only. MTOOLCFG is a one-line YAML config for mongodump (password with
# single-quote escaping), handed to mongodump through a file descriptor.
mongo_exec() {
  (
    export MU="$MONGO_BACKUP_USER" MP="$MONGO_BACKUP_PASSWORD" MDB="$MONGO_DB" MCOLS="$MANIFEST_COLLECTIONS"
    export MTOOLCFG="password: '${MONGO_BACKUP_PASSWORD//\'/\'\'}'"
    "$DOCKER" exec -e MU -e MP -e MDB -e MCOLS -e MTOOLCFG "$MONGO_CONTAINER" "$@"
  )
}

# ---------------------------------------------------------------- 1. document counts
STEP="counting documents (manifest)"
COUNT_JS='
const conn = new Mongo("mongodb://127.0.0.1:27017/?directConnection=true");
conn.getDB("admin").auth(process.env.MU, process.env.MP);
const appDb = conn.getDB(process.env.MDB);
const counts = {};
for (const name of process.env.MCOLS.split(/\s+/).filter(Boolean)) {
  counts[name] = appDb.getCollection(name).countDocuments({});
}
print(JSON.stringify(counts));
'
counts_json=$(mongo_exec mongosh --nodb --quiet --eval "$COUNT_JS" | tail -n 1)
printf '%s' "$counts_json" | jq -e 'type == "object"' >/dev/null || die "could not read document counts"
log "document counts: $(printf '%s' "$counts_json" | jq -c .)"

# ---------------------------------------------------------------- 2. dump
STEP="running mongodump"
partial="$LOCAL_BACKUP_DIR/.${ARCHIVE_NAME}.partial"
log "dumping to $LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
mongo_exec bash -c 'mongodump --config=<(printf "%s\n" "$MTOOLCFG") --host=127.0.0.1 --port=27017 \
  --username="$MU" --authenticationDatabase=admin --oplog --gzip --archive --quiet' > "$partial"

bytes=$(stat -c '%s' -- "$partial")
(( bytes >= MIN_ARCHIVE_BYTES )) || die "dump is suspiciously small (${bytes} bytes)"
sha=$(sha256sum -- "$partial" | awk '{ print $1 }')
chmod 600 -- "$partial"
mv -f -- "$partial" "$LOCAL_BACKUP_DIR/$ARCHIVE_NAME"

STEP="writing the manifest"
jq -n \
  --arg archive "$ARCHIVE_NAME" --arg createdAt "$(date -u -d "@$NOW" +%Y-%m-%dT%H:%M:%SZ)" \
  --arg db "$MONGO_DB" --arg sha "$sha" --argjson bytes "$bytes" --argjson counts "$counts_json" \
  --arg host "$(hostname)" \
  '{format: 1, archive: $archive, createdAt: $createdAt, host: $host, database: $db,
    countsTakenBeforeDump: $counts, archiveSha256: $sha, archiveBytes: $bytes,
    restoreWith: "mongorestore --archive --gzip --oplogReplay --drop"}' \
  > "$LOCAL_BACKUP_DIR/.${MANIFEST_NAME}.tmp"
chmod 600 -- "$LOCAL_BACKUP_DIR/.${MANIFEST_NAME}.tmp"
mv -f -- "$LOCAL_BACKUP_DIR/.${MANIFEST_NAME}.tmp" "$LOCAL_BACKUP_DIR/$MANIFEST_NAME"
log "local copy saved ($(( bytes / 1024 )) KiB, sha256 ${sha:0:12}...)"

# ---------------------------------------------------------------- 3. local rotation
STEP="removing old local copies"
mapfile -t old_copies < <(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type f -name 'peshkar-mongo-*.archive.gz' -printf '%f\n' \
  | sort -r | tail -n +"$(( KEEP_LOCAL + 1 ))")
for f in "${old_copies[@]+"${old_copies[@]}"}"; do
  rm -f -- "$LOCAL_BACKUP_DIR/$f" "$LOCAL_BACKUP_DIR/${f%.archive.gz}.manifest.json"
done
local_count=$(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type f -name 'peshkar-mongo-*.archive.gz' | wc -l)
log "removed ${#old_copies[@]} old local copies; ${local_count} kept"

# ---------------------------------------------------------------- 4. encrypt + upload
STEP="encrypting"
enc_archive="$WORK_DIR/${ARCHIVE_NAME}.age"
enc_manifest="$WORK_DIR/${MANIFEST_NAME}.age"
WORK_FILES+=("$enc_archive" "$enc_manifest")
age "${AGE_ARGS[@]}" -o "$enc_archive" -- "$LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
age "${AGE_ARGS[@]}" -o "$enc_manifest" -- "$LOCAL_BACKUP_DIR/$MANIFEST_NAME"

upload() { # upload LOCAL_FILE REMOTE_DIR
  # -q hides routine notices (e.g. "no rclone.conf", expected: we configure by env); errors still show.
  rclone copyto -q --s3-no-check-bucket --retries 5 --low-level-retries 10 --stats 0 \
    -- "$1" "${REMOTE}/$2/$(basename -- "$1")"
}

STEP="uploading the hourly copy"
upload "$enc_archive" "mongodump/hourly/$Y/$M/$D"
upload "$enc_manifest" "mongodump/hourly/$Y/$M/$D"
log "uploaded to mongodump/hourly/$Y/$M/$D/"
summary="hourly"

daily_marker="$LOCAL_BACKUP_DIR/.last-daily-upload"
last_daily=$(cat -- "$daily_marker" 2>/dev/null || true)
if [ "$FORCE_DAILY" = "1" ] || { (( 10#$HOUR >= 10#$DAILY_UTC_HOUR )) && [ "$last_daily" != "$TODAY" ]; }; then
  STEP="uploading the daily copy"
  upload "$enc_archive" "mongodump/daily/$Y/$M"
  upload "$enc_manifest" "mongodump/daily/$Y/$M"
  log "uploaded to mongodump/daily/$Y/$M/"

  STEP="uploading the config files"
  enc_config="$WORK_DIR/peshkar-config-${STAMP}.tar.gz.age"
  WORK_FILES+=("$enc_config")
  read -r -a config_files <<< "$CONFIG_FILES"
  for f in "${config_files[@]}"; do
    [ -f "$APP_DIR/$f" ] && [ -r "$APP_DIR/$f" ] || die "config file $APP_DIR/$f not found or not readable"
  done
  tar -C "$APP_DIR" -czf - -- "${config_files[@]}" | age "${AGE_ARGS[@]}" -o "$enc_config"
  upload "$enc_config" "config/$Y/$M"
  log "uploaded config files to config/$Y/$M/"
  printf '%s\n' "$TODAY" > "$daily_marker"
  summary="hourly+daily+config"
fi

# ---------------------------------------------------------------- done
STEP="finishing"
for f in "${WORK_FILES[@]}"; do rm -f -- "$f"; done
WORK_FILES=()
msg="OK ${ARCHIVE_NAME} $(( bytes / 1024 )) KiB uploaded:${summary} local_copies:${local_count} counts:$(printf '%s' "$counts_json" | jq -c .)"
log "$msg"
SUCCESS_SENT=1
hc_ping "" "$msg"
