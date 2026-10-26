#!/usr/bin/env bash
# Create (or update) the least-privilege MongoDB user used by the hourly backup.
# Roles: backup + clusterMonitor (can read everything for a dump; cannot change or delete data).
#
# Run on the server from the repo root, AFTER /etc/peshkar-backup/backup.env exists:
#   sudo bash scripts/backup/create-backup-user.sh
# Undo (removes the user; backups then stop working):
#   sudo bash scripts/backup/create-backup-user.sh --remove
#
# The root credentials come from .env.production and the backup password from backup.env.
# Both are handed to the container as environment variables, never on a command line.
set -Eeuo pipefail
umask 077

APP_ENV="${APP_ENV:-.env.production}"
BACKUP_ENV="${ENV_FILE:-/etc/peshkar-backup/backup.env}"
DOCKER="${DOCKER:-docker}"
ACTION="${1:-create}"

# Value of KEY in FILE: first KEY=... line, surrounding quotes and Windows line endings removed.
get_val() {
  local v
  v=$(grep -E "^$2=" "$1" | head -1 | cut -d= -f2- || true)
  v=${v%$'\r'}
  if [[ $v =~ ^\"(.*)\"$ ]] || [[ $v =~ ^\'(.*)\'$ ]]; then v=${BASH_REMATCH[1]}; fi
  printf '%s' "$v"
}

[ -f "$APP_ENV" ] || { echo "Missing $APP_ENV (run from the repo root on the server)"; exit 1; }
[ -f "$BACKUP_ENV" ] || { echo "Missing $BACKUP_ENV (create it first, see docs/runbooks/database-backups.md)"; exit 1; }

MU=$(get_val "$APP_ENV" MONGO_INITDB_ROOT_USERNAME)
MP=$(get_val "$APP_ENV" MONGO_INITDB_ROOT_PASSWORD)
BU=$(get_val "$BACKUP_ENV" MONGO_BACKUP_USER)
BP=$(get_val "$BACKUP_ENV" MONGO_BACKUP_PASSWORD)
BU=${BU:-peshkar_backup}
CONTAINER="${MONGO_CONTAINER:-$(get_val "$BACKUP_ENV" MONGO_CONTAINER)}"
CONTAINER="${CONTAINER:-peshkar-mongodb}"
[ -n "$MU" ] && [ -n "$MP" ] || { echo "MONGO_INITDB_ROOT_USERNAME/PASSWORD not found in $APP_ENV"; exit 1; }
if [ "$ACTION" != "--remove" ]; then
  [ -n "$BP" ] || { echo "MONGO_BACKUP_PASSWORD is empty in $BACKUP_ENV"; exit 1; }
  case "$BP" in CHANGE_ME*) echo "MONGO_BACKUP_PASSWORD is still the placeholder; generate one with: openssl rand -hex 32"; exit 1;; esac
fi
export MU MP BU BP ACTION

"$DOCKER" exec -e MU -e MP -e BU -e BP -e ACTION "$CONTAINER" mongosh --nodb --quiet --eval '
const conn = new Mongo("mongodb://127.0.0.1:27017/?directConnection=true");
const admin = conn.getDB("admin");
admin.auth(process.env.MU, process.env.MP);
const user = process.env.BU;
const roles = [{ role: "backup", db: "admin" }, { role: "clusterMonitor", db: "admin" }];
if (process.env.ACTION === "--remove") {
  if (admin.getUser(user)) { admin.dropUser(user); print("Removed MongoDB user " + user); }
  else { print("MongoDB user " + user + " does not exist; nothing to remove"); }
} else if (admin.getUser(user)) {
  admin.updateUser(user, { pwd: process.env.BP, roles: roles });
  print("Updated MongoDB user " + user + " (roles: backup, clusterMonitor)");
} else {
  admin.createUser({ user: user, pwd: process.env.BP, roles: roles });
  print("Created MongoDB user " + user + " (roles: backup, clusterMonitor)");
}
'
