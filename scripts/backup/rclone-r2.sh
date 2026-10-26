#!/usr/bin/env bash
# Run one rclone command against the backup bucket, using the R2 settings in
# /etc/peshkar-backup/backup.env (override with ENV_FILE=...). The path you give is inside the
# bucket; "r2:<bucket>/" is added for you. Examples, on the server from the repo root:
#   sudo bash scripts/backup/rclone-r2.sh lsf -R mongodump/daily/        # list daily backups
#   sudo bash scripts/backup/rclone-r2.sh ls mongodump/hourly/2026/10/26/
#   echo test | sudo bash scripts/backup/rclone-r2.sh rcat mongodump/hourly/lock-test.txt
#   sudo bash scripts/backup/rclone-r2.sh deletefile mongodump/hourly/lock-test.txt
# Write flags that take a value as --flag=value (e.g. --include='*.age'), so the value is not
# mistaken for the path.
# Uses the server's WRITE token: it can add files, and the bucket lock rules stop it deleting them.
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/etc/peshkar-backup/backup.env}"
[ $# -ge 1 ] || { echo "Usage: $0 <rclone command> [path inside the bucket] [more rclone args]"; exit 2; }
[ -r "$ENV_FILE" ] || { echo "Cannot read $ENV_FILE (use sudo?)"; exit 1; }

# Same safe KEY=value reader as mongo-backup.sh (the file is never executed).
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  [[ $line =~ ^[[:space:]]*(export[[:space:]]+)?(RCLONE_[A-Za-z0-9_]*|R2_BUCKET)=(.*)$ ]] || continue
  key=${BASH_REMATCH[2]}
  val=${BASH_REMATCH[3]}
  if [[ $val =~ ^\"(.*)\"$ ]] || [[ $val =~ ^\'(.*)\'$ ]]; then val=${BASH_REMATCH[1]}; fi
  [ -n "${!key+x}" ] || printf -v "$key" '%s' "$val"
  export "${key?}"
done < "$ENV_FILE"

[ -n "${R2_BUCKET:-}" ] || { echo "R2_BUCKET is missing in $ENV_FILE"; exit 1; }
REMOTE="${RCLONE_REMOTE:-r2}"

cmd=$1
shift
# The first argument that is not a --flag is the path inside the bucket; flags may come anywhere.
args=()
have_path=0
for a in "$@"; do
  if [ "$have_path" = 0 ] && [[ $a != -* ]]; then
    args+=("${REMOTE}:${R2_BUCKET}/${a#/}")
    have_path=1
  else
    args+=("$a")
  fi
done
[ "$have_path" = 1 ] || args=("${REMOTE}:${R2_BUCKET}/" "${args[@]+"${args[@]}"}")
exec rclone --s3-no-check-bucket "$cmd" "${args[@]}"
