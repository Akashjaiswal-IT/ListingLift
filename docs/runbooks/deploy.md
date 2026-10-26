# Deploy runbook (every release)

Back up the database before **every** deploy and keep the copy on your own PC. There is no
automated backup, so this copy is the only way to undo a bad deploy or a wiped database.

Server: `ssh root@93.127.167.18`. Never run `docker compose down -v`, `docker volume prune` or
`docker system prune --volumes`; they delete the database.

## 1. Back up the database (server)

```bash
cd /root/ListingLift
STAMP=$(date +%Y%m%d-%H%M%S); mkdir -p /root/backups
docker exec peshkar-mongodb sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/tmp/b.gz'
docker cp peshkar-mongodb:/tmp/b.gz /root/backups/peshkar-mongo-$STAMP.gz
docker exec peshkar-mongodb rm -f /tmp/b.gz
gzip -t /root/backups/peshkar-mongo-$STAMP.gz && echo BACKUP-OK && ls -lh /root/backups/peshkar-mongo-$STAMP.gz
```

- Expected: `done dumping ...` lines, then `BACKUP-OK` and the file size.
- **No `BACKUP-OK` = stop. Do not deploy.**

## 2. Copy the backup to your PC (PowerShell on your laptop)

```powershell
mkdir $HOME\Documents\peshkar-db-backups -Force
scp root@93.127.167.18:/root/backups/peshkar-mongo-*.gz $HOME\Documents\peshkar-db-backups\
dir $HOME\Documents\peshkar-db-backups
```

- Expected: the newest file is listed with about the same size as on the server.

## 3. Deploy (server)

Worker first, then API, building one image at a time (the server has 1 vCPU).

```bash
cd /root/ListingLift && git pull origin main
docker compose -f docker-compose.server.yml build worker && docker compose -f docker-compose.server.yml up -d --no-deps worker
docker compose -f docker-compose.server.yml build api-service && docker compose -f docker-compose.server.yml up -d --no-deps api-service
```

If the release changed `docker-compose.server.yml`, finish with
`docker compose -f docker-compose.server.yml up -d`.

## 4. Check it works

```bash
sleep 30; docker compose -f docker-compose.server.yml ps
curl -s https://api.peshkarai.in/health; echo
docker logs --tail 20 peshkar-server-worker-1 | grep "All BullMQ Workers active"
```

- Expected: all services `Up`; health `{"healthy":true,...}`; the worker line is printed.
- Then create one quick test listing in the app.

## 5. Tidy up

Keep only the last 5 backups on the server:

```bash
ls -1t /root/backups/peshkar-mongo-*.gz | tail -n +6 | xargs -r rm -f
```

On your PC keep at least the last 5-10 files; delete older ones by hand.

## Restore a backup (only if data is damaged or lost)

This **replaces** the current database; anything written after the backup is lost.

```powershell
# On your PC: send the backup to the server (use the right file name)
scp $HOME\Documents\peshkar-db-backups\peshkar-mongo-XXXX.gz root@93.127.167.18:/root/backups/
```

```bash
# On the server
docker cp /root/backups/peshkar-mongo-XXXX.gz peshkar-mongodb:/tmp/r.gz
docker exec peshkar-mongodb sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/tmp/r.gz --drop'
docker exec peshkar-mongodb rm -f /tmp/r.gz
docker compose -f docker-compose.server.yml restart api-service worker
```

## Notes

- Backup files contain user data. Keep the PC folder private; never upload it anywhere public.
- Also back up before risky one-off actions (scripts against the database, manual data edits).
- The web app deploys itself on Vercel when `main` is pushed.
- First-time server setup and tuning: `vm-tuning.md`. Replica set: `mongo-replica-set.md`.
