#!/usr/bin/env bash
# One-time (safe to re-run): turn the production MongoDB container into a single-node replica set
# so multi-document transactions work. Run on the server from the repo root:
#   bash scripts/enable-mongo-replica-set.sh
set -euo pipefail

COMPOSE="docker compose -f docker-compose.server.yml"
CONTAINER="peshkar-mongodb"
ENV_FILE=".env.production"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (run from the repo root on the server)"; exit 1; }
MONGO_USER=$(grep -E '^MONGO_INITDB_ROOT_USERNAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'")
MONGO_PASS=$(grep -E '^MONGO_INITDB_ROOT_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'")
[ -n "$MONGO_USER" ] && [ -n "$MONGO_PASS" ] || { echo "MONGO_INITDB_ROOT_USERNAME/PASSWORD not found in $ENV_FILE"; exit 1; }

mongosh_admin() {
  docker exec -e MU="$MONGO_USER" -e MP="$MONGO_PASS" "$CONTAINER" \
    sh -c 'mongosh --quiet -u "$MU" -p "$MP" --authenticationDatabase admin --eval "$0"' "$1"
}

echo "1/5 Backing up the database (inside the data volume)..."
STAMP=$(date +%Y%m%d-%H%M%S)
docker exec -e MU="$MONGO_USER" -e MP="$MONGO_PASS" "$CONTAINER" \
  sh -c 'mongodump -u "$MU" -p "$MP" --authenticationDatabase admin --gzip --archive=/data/db/backup-before-replset-'"$STAMP"'.gz'
echo "    Backup: /data/db/backup-before-replset-$STAMP.gz (in the peshkar_mongo_data volume)"

echo "2/5 Creating the replica-set keyfile (if missing)..."
if [ ! -f mongo-keyfile ]; then
  openssl rand -base64 756 > mongo-keyfile
fi
chmod 400 mongo-keyfile
chown 999:999 mongo-keyfile   # the mongodb user inside the official image

echo "3/5 Restarting MongoDB with --replSet rs0..."
$COMPOSE up -d --no-deps mongodb
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "4/5 Initiating the replica set (skipped if already done)..."
mongosh_admin 'try { rs.status(); print("already initiated") } catch (e) { if (e.codeName === "NotYetInitialized") { printjson(rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] })) } else { throw e } }'

echo "5/5 Waiting for PRIMARY..."
for i in $(seq 1 30); do
  STATE=$(mongosh_admin 'rs.status().myState' 2>/dev/null || true)
  if [ "$STATE" = "1" ]; then echo "    Replica set rs0 is PRIMARY."; break; fi
  sleep 2
done
[ "${STATE:-}" = "1" ] || { echo "Replica set did not become PRIMARY; check: docker logs $CONTAINER"; exit 1; }

cat <<'NEXT'

Done. Now:
  1. In .env.production add  &replicaSet=rs0  to MONGODB_URI, e.g.
     mongodb://USER:PASS@mongodb:27017/peshkar?authSource=admin&replicaSet=rs0
  2. Rebuild and restart the app containers:
     docker compose -f docker-compose.server.yml build api-service worker
     docker compose -f docker-compose.server.yml up -d --no-deps api-service worker
     docker compose -f docker-compose.server.yml up -d --no-deps --force-recreate caddy
NEXT
