#!/usr/bin/env bash
# Peshkar AI - weekly restore drill. Proves the newest hourly backup in R2 can really be
# decrypted and restored, and that it contains what the manifest says.
#
# Run by .github/workflows/restore-drill.yml, one sub-command per workflow step:
#   restore-drill.sh start-mongo   start a throwaway mongo:7 replica set (rs0) container
#   restore-drill.sh fetch         download the newest hourly archive + manifest (read-only token)
#   restore-drill.sh decrypt       decrypt them (needs AGE_KEY_FILE = path to the private key file)
#   restore-drill.sh verify        mongorestore --oplogReplay, then compare checksum + counts
#   restore-drill.sh cleanup       remove the container and every downloaded/decrypted file
#
# It prints only PASS/FAIL lines: never document contents, counts, names of people or secrets.
# Tool output (rclone, age, mongorestore) is discarded because error messages can quote data
# (for example a duplicate-key error shows the duplicated email address).
set -Eeuo pipefail
umask 077

DRILL_DIR="${DRILL_DIR:-${RUNNER_TEMP:-/tmp}/peshkar-drill}"
CONTAINER="${DRILL_CONTAINER:-peshkar-drill-mongo}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:7}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-3}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"
HOURLY_PREFIX="${HOURLY_PREFIX:-mongodump/hourly}"

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; exit 1; }

mongo_eval() { # run JavaScript in the throwaway container; only our own print() output is kept
  docker exec -e MDB="${MDB:-}" -e MCOLS="${MCOLS:-}" "$CONTAINER" mongosh --quiet --eval "$1" 2>/dev/null
}

start_mongo() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" "$MONGO_IMAGE" --replSet rs0 --bind_ip_all >/dev/null 2>&1 \
    || fail "could not start a throwaway $MONGO_IMAGE container"
  local i
  for i in $(seq 1 60); do
    mongo_eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null && break
    sleep 2
  done
  mongo_eval 'try { rs.status().ok } catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] }).ok }' >/dev/null \
    || fail "could not initiate the throwaway replica set"
  for i in $(seq 1 60); do
    [ "$(mongo_eval 'rs.status().myState' || true)" = "1" ] && { pass "throwaway MongoDB replica set is ready"; return 0; }
    sleep 2
  done
  fail "throwaway replica set did not become PRIMARY"
}

fetch() {
  [ -n "${R2_BUCKET:-}" ] || fail "R2_BUCKET is not set (repository secret missing?)"
  rm -rf -- "$DRILL_DIR"
  mkdir -p -- "$DRILL_DIR"
  local remote="${RCLONE_REMOTE}:${R2_BUCKET}/${HOURLY_PREFIX}" newest stamp ts age_s
  newest=$(rclone lsf -R --files-only --s3-no-check-bucket --include '*.archive.gz.age' "$remote" 2>/dev/null | sort | tail -n 1) \
    || fail "could not list backups in R2 (check the R2_* secrets of the read-only token)"
  [ -n "$newest" ] || fail "no hourly backups found in R2"

  [[ $newest =~ ([0-9]{8})T([0-9]{6})Z ]] || fail "unexpected backup file name"
  stamp="${BASH_REMATCH[1]}T${BASH_REMATCH[2]}"
  ts=$(date -u -d "${stamp:0:4}-${stamp:4:2}-${stamp:6:2}T${stamp:9:2}:${stamp:11:2}:${stamp:13:2}Z" +%s) \
    || fail "could not read the backup time"
  age_s=$(( $(date -u +%s) - ts ))
  if (( age_s > MAX_AGE_HOURS * 3600 )); then
    fail "newest backup is older than ${MAX_AGE_HOURS} hours: hourly backups have stopped"
  fi
  pass "newest backup is less than ${MAX_AGE_HOURS} hours old"

  rclone copyto -q --s3-no-check-bucket "$remote/$newest" "$DRILL_DIR/archive.gz.age" >/dev/null 2>&1 \
    || fail "could not download the newest archive"
  rclone copyto -q --s3-no-check-bucket "$remote/${newest%.archive.gz.age}.manifest.json.age" "$DRILL_DIR/manifest.json.age" >/dev/null 2>&1 \
    || fail "could not download the manifest that belongs to the newest archive"
  pass "downloaded the newest encrypted archive and manifest"
}

decrypt() {
  [ -n "${AGE_KEY_FILE:-}" ] && [ -s "$AGE_KEY_FILE" ] || fail "AGE_KEY_FILE is missing or empty (AGE_PRIVATE_KEY secret missing?)"
  age -d -i "$AGE_KEY_FILE" -o "$DRILL_DIR/archive.gz" "$DRILL_DIR/archive.gz.age" >/dev/null 2>&1 \
    || fail "could not decrypt the archive (does AGE_PRIVATE_KEY match the server's AGE_RECIPIENT?)"
  age -d -i "$AGE_KEY_FILE" -o "$DRILL_DIR/manifest.json" "$DRILL_DIR/manifest.json.age" >/dev/null 2>&1 \
    || fail "could not decrypt the manifest"
  rm -f -- "$DRILL_DIR/archive.gz.age" "$DRILL_DIR/manifest.json.age"
  pass "decrypted the archive and manifest"
}

verify() {
  local manifest="$DRILL_DIR/manifest.json" archive="$DRILL_DIR/archive.gz" want_sha got_sha
  jq -e '.format == 1 and (.countsTakenBeforeDump | type == "object")' "$manifest" >/dev/null 2>&1 \
    || fail "manifest is not valid"
  want_sha=$(jq -r '.archiveSha256' "$manifest")
  got_sha=$(sha256sum -- "$archive" | awk '{ print $1 }')
  [ "$want_sha" = "$got_sha" ] || fail "archive checksum does not match the manifest (corrupted?)"
  pass "archive checksum matches the manifest"

  docker exec -i "$CONTAINER" mongorestore --archive --gzip --oplogReplay --drop --quiet < "$archive" >/dev/null 2>&1 \
    || fail "mongorestore --oplogReplay failed"
  pass "mongorestore --archive --gzip --oplogReplay --drop completed"

  local restored
  MDB=$(jq -r '.database' "$manifest")
  MCOLS=$(jq -r '.countsTakenBeforeDump | keys | join(" ")' "$manifest")
  [[ $MDB =~ ^[A-Za-z0-9_-]+$ ]] || fail "unexpected database name in the manifest"
  restored=$(MDB="$MDB" MCOLS="$MCOLS" mongo_eval '
    const d = db.getSiblingDB(process.env.MDB); const out = {};
    for (const n of process.env.MCOLS.split(" ").filter(Boolean)) out[n] = d.getCollection(n).countDocuments({});
    print(JSON.stringify(out));' | tail -n 1) || fail "could not count documents after the restore"
  printf '%s' "$restored" | jq -e 'type == "object"' >/dev/null 2>&1 || fail "could not count documents after the restore"

  # Counts were taken just BEFORE the dump, and the dump includes writes made while it ran,
  # so a restored count may be equal or slightly higher, never lower.
  local name ok=1
  for name in $MCOLS; do
    if jq -e --arg n "$name" --argjson r "$restored" '$r[$n] >= .countsTakenBeforeDump[$n]' "$manifest" >/dev/null 2>&1; then
      pass "collection $name restored with the expected number of documents"
    else
      echo "FAIL: collection $name has fewer documents than the manifest"
      ok=0
    fi
  done
  [ "$ok" = 1 ] || fail "document counts do not match the manifest"
  pass "restore drill complete"
}

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf -- "$DRILL_DIR"
  echo "cleaned up"
}

case "${1:-}" in
  start-mongo) start_mongo ;;
  fetch) fetch ;;
  decrypt) decrypt ;;
  verify) verify ;;
  cleanup) cleanup ;;
  *) echo "usage: $0 start-mongo|fetch|decrypt|verify|cleanup"; exit 2 ;;
esac
