# Deploy runbook (every release)

Back up the database before **every** deploy and keep the copy on your own PC. There is no
automated backup service (see `database-backups.md`), so this copy is the way to undo a bad deploy
or a wiped database. Copy the commands one at a time.

- 🖥️ **VM** = run in your SSH window (`ssh root@93.127.167.18`). `~` is root's home folder.
- 💻 **LOCAL** = run in PowerShell on your laptop.
- Never run `docker compose down -v`, `docker volume prune` or `docker system prune --volumes`;
  they delete the database.
- Use the same SSH window from step 1 to step 5 (`STAMP` is set in step 1).
- The folders `~/backups` (VM) and `Documents\peshkar-db-backups` (PC) already exist. Only on a
  new server or new PC, create them once: `mkdir -p ~/backups` (VM) and
  `mkdir $HOME\Documents\peshkar-db-backups` (PC).

## 1. Back up the database 🖥️ VM

```bash
STAMP=$(date +%Y%m%d-%H%M%S) && echo $STAMP
```
```bash
docker exec peshkar-mongodb sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/tmp/b.gz'
```
```bash
docker cp peshkar-mongodb:/tmp/b.gz ~/backups/peshkar-mongo-$STAMP.gz
```
```bash
docker exec peshkar-mongodb rm -f /tmp/b.gz
```
```bash
gzip -t ~/backups/peshkar-mongo-$STAMP.gz && echo BACKUP-OK && ls -lh ~/backups/peshkar-mongo-$STAMP.gz
```

- Expected: `done dumping ...` lines, then `BACKUP-OK` and the file size.
- **No `BACKUP-OK` = stop. Do not deploy.**

## 2. Copy the backup to your PC 💻 LOCAL

```powershell
scp root@93.127.167.18:~/backups/peshkar-mongo-*.gz $HOME\Documents\peshkar-db-backups\
```
```powershell
dir $HOME\Documents\peshkar-db-backups
```

- Expected: the newest file is listed with about the same size as on the server.

## 3. Deploy 🖥️ VM

Worker first, then API, building one image at a time (the server has 1 vCPU).

```bash
cd ~/ListingLift
```
```bash
git pull origin main
```
```bash
docker compose -f docker-compose.server.yml build worker
```
```bash
docker compose -f docker-compose.server.yml up -d --no-deps worker
```
```bash
docker compose -f docker-compose.server.yml build api-service
```
```bash
docker compose -f docker-compose.server.yml up -d --no-deps api-service
```

Only if the release changed `docker-compose.server.yml`:

```bash
docker compose -f docker-compose.server.yml up -d
```

## 4. Check it works 🖥️ VM

Wait 30 seconds, then:

```bash
docker compose -f docker-compose.server.yml ps
```
```bash
curl -s https://api.peshkarai.in/health
```
```bash
docker logs --tail 20 peshkar-server-worker-1 | grep "All BullMQ Workers active"
```

- Expected: all services `Up`; health `{"healthy":true,...}`; the worker line is printed.
- Then create one quick test listing in the app.

## 5. Tidy up 🖥️ VM

Keep only the last 5 backups on the server:

```bash
ls -1t ~/backups/peshkar-mongo-*.gz | tail -n +6 | xargs -r rm -f
```

On your PC keep at least the last 5-10 files; delete older ones by hand.

## If something goes wrong

- Code problem, data fine: in `~/ListingLift` run `git log --oneline -5`, then
  `git checkout <previous commit>`, then repeat step 3 from the `build worker` line. Once the fix is
  pushed, run `git checkout main` before the next deploy.
- Data damaged or deleted: restore the backup from step 1, see `database-backups.md` section 6.
- Server broken: Hostinger auto-backup or snapshot, see `database-backups.md` sections 4, 5 and 7.

## Notes

- The web app deploys itself on Vercel when `main` is pushed.
- Backup files contain user data. Keep the PC folder private; never upload it anywhere public.
- First-time server setup and tuning: `vm-tuning.md`. Replica set: `mongo-replica-set.md`.
