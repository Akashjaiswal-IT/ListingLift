# MongoDB as a one-node replica set (required for transactions)

Credits, payments and refunds use multi-document transactions. MongoDB only runs transactions on a
replica set; a standalone server rejects them ("Transaction numbers are only allowed on a replica
set member or mongos"). A one-node replica set has the same redundancy as the old standalone setup.

In production the API and worker **refuse to start** without a replica set, so money flows can
never run without all-or-nothing guarantees. In development (standalone Mongo) they run without
transactions and log a warning.

## Order of the release (important)

1. `git pull origin main` on the server.
2. `bash scripts/enable-mongo-replica-set.sh`: backs up, creates `mongo-keyfile`, restarts Mongo
   with `--replSet rs0`, runs `rs.initiate()`, waits for PRIMARY. Takes a few minutes; the app is
   briefly unavailable while Mongo restarts.
3. Add `&replicaSet=rs0` to `MONGODB_URI` in `.env.production`.
4. Rebuild and restart api-service and worker, and recreate caddy (new Caddyfile):
   ```bash
   docker compose -f docker-compose.server.yml build api-service worker
   docker compose -f docker-compose.server.yml up -d --no-deps api-service worker
   docker compose -f docker-compose.server.yml up -d --no-deps --force-recreate caddy
   ```
5. Check: `curl https://api.peshkarai.in/health` returns 200, the worker logs show
   "All BullMQ Workers active", and `curl https://api.peshkarai.in/ip` shows **your own** public IP
   (not a 172.x / 10.x address). If it shows a private address, set `TRUST_PROXY_HOPS` accordingly.

## Rollback

Restore the previous `docker-compose.server.yml` (no `command:` line) and the old `MONGODB_URI`,
then `docker compose -f docker-compose.server.yml up -d --no-deps mongodb`. Data is untouched by the
conversion; the backup from step 2 is in the data volume as `backup-before-replset-*.gz`.

**Never run `docker compose down -v`**: it deletes the database volume.
