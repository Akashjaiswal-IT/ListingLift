# VM tuning runbook (Hostinger KVM 1: 1 vCPU, 4 GB RAM, 50 GB disk)

This runbook applies the performance plan to the production server `srv1933210` (93.127.167.18).
It is written to be followed **in order**, one step at a time. Every step has: what to run, what
you should see, and how to undo it.

**What it fixes (measured on 2026-10-24):**

| Problem | Today | After |
|---|---|---|
| Disk | 35 GB used, 28 GB of it old Docker build cache | ~7 GB used, cache kept under 5 GB |
| Idle CPU | ~12% (half of it health checks; Mongo's check alone ~5%) | ~5-7% |
| RAM | dockerd 600 MB, two `pnpm` wrapper processes ~200 MB, Mongo cache unbounded (could grow to ~1.4 GB) | ~600 MB less used, Mongo capped at 256 MB cache |
| Images | api/worker ~1 GB each (whole monorepo + dev tools) | ~0.3-0.45 GB each |
| Logs | never rotated (Mongo log grew ~60 MB/day) | max 3 x 10 MB per container |
| Safety | no swap, NotebookLM unlimited, Dozzle logs public without login, NotebookLM image contained TLS keys + an old .env | 2 GB emergency swap, limits, login, no secrets in images |
| API | card re-rendering and ZIP bundles ran inside the API and froze it | they run in the worker ("assets" queue) |

**Downtime:** steps 6 and 7 each restart containers (about 1-2 minutes each). Steps 8-11 cause a
few seconds each. Do it at a quiet time.

## DO NOT (read once before starting)

- Never run `docker compose down -v`, `docker volume prune`, `docker volume rm ...`, or
  `docker system prune --volumes`. The `-v`/volume commands **delete the database**.
- Never run `docker system prune -a` (it would delete the rollback images tagged `:pre-slim`).
- Never delete or edit `~/ListingLift/mongo-keyfile`, never run `rs.initiate()` again, never
  remove `--replSet rs0` / `--keyFile` from the compose file or `replicaSet=rs0` from `MONGODB_URI`
  (see `docs/runbooks/mongo-replica-set.md`).
- Never `cat` the `.env` files into a chat or ticket.
- Build only one image at a time on the server (1 vCPU).
- Keep your current SSH window open while doing the SSH steps in section 14.

All commands are run on the server as `root`, unless a step says "on your laptop".

---

## 0. Before you start

- Both repos (ListingLift and NotebookLM-Clone) are pushed; the server steps below `git pull` them.
- The Mongo replica set must already be done (`mongo-replica-set.md`). Check:
  `grep -o 'replicaSet=rs0' ~/ListingLift/.env.production` must print `replicaSet=rs0`.
- `~` is root's home folder, so every `cd ~/...` works from anywhere.
- Hostinger weekly auto-backups are on (hPanel -> VPS -> Backups); they can be days old, so the
  snapshot (step 1) and database backup (step 3) are still taken right before starting.

## 1. Take a VPS snapshot (safety net for everything below)

Hostinger hPanel -> VPS -> **Snapshots & Backups** -> **Create snapshot**. Wait until it is listed.

- Expected: a snapshot with today's date.
- Rollback for the whole runbook: restore this snapshot (it brings back the server exactly as it is now).

## 2. Save copies of the current config files

```bash
mkdir -p ~/backups && STAMP=$(date +%Y%m%d-%H%M%S) && echo $STAMP
cp ~/ListingLift/docker-compose.server.yml ~/backups/peshkar-compose.$STAMP.yml
cd ~/NotebookLM-Clone/backend
for f in docker-compose.server.yml docker-compose.api-gateway.yml docker-compose.logs.yml; do cp $f ~/backups/nlm-$f.$STAMP; done
ls -l ~/backups
```

- Expected: the 4 files listed. **Write down the STAMP value** (e.g. `20261027-221500`); the
  rollback commands below use it. If you open a new SSH session, set it again: `STAMP=<that value>`.

## 3. Back up MongoDB (and copy it to your laptop)

```bash
docker exec peshkar-mongodb sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=/tmp/b.gz'
docker cp peshkar-mongodb:/tmp/b.gz ~/backups/peshkar-mongo-$STAMP.gz
docker exec peshkar-mongodb rm -f /tmp/b.gz
gzip -t ~/backups/peshkar-mongo-$STAMP.gz && echo BACKUP-OK && ls -lh ~/backups/peshkar-mongo-$STAMP.gz
```

- Expected: `done dumping ...` lines, then `BACKUP-OK` and a file bigger than a few hundred KB.
- **No `BACKUP-OK` = stop here.**
- Then **on your laptop** (PowerShell), same folder as `deploy.md`:
  `mkdir $HOME\Documents\peshkar-db-backups -Force`
  `scp root@93.127.167.18:~/backups/peshkar-mongo-*.gz $HOME\Documents\peshkar-db-backups\`
- Rollback: nothing to undo (read-only).

## 4. Free ~28 GB of disk (old build cache)

```bash
df -h /                      # note "Used" (about 35G)
docker builder prune -af
docker system df
df -h /
```

- Expected: `Total reclaimed space: ~28GB`; `docker system df` shows `Build Cache ... 0B`;
  `df -h /` shows about **6-8G used**.
- This removes only cached build steps. Images, containers and volumes (your data) are untouched.
  The next image build is slower once (it downloads packages again).
- Rollback: not needed.

## 5. Add a 2 GB swap file (emergency buffer)

**What this is, in plain words.** Swap is a file on the disk that Linux can use as overflow when
RAM is completely full. Right now the server has **no swap**: if RAM ever runs out (e.g. a big
image build while users are generating listings), Linux immediately kills a process, possibly
MongoDB or the worker. With swap, it instead parks rarely-used memory on disk for a moment.

**Why it is safe:**
- `vm.swappiness=10` tells Linux to keep using RAM and only touch swap when RAM is nearly full,
  so in normal operation swap stays at 0 and nothing gets slower.
- It uses 2 GB of the ~40 GB that will be free after step 4.
- It is fully reversible with three commands (below) and changes no app or data.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
sysctl -p /etc/sysctl.d/99-swappiness.conf
swapon --show; free -m
```

- Expected: `swapon --show` lists `/swapfile file 2G 0B`; `vm.swappiness = 10`; `free -m` shows
  `Swap: 2047 0 2047`.
- Rollback:
  ```bash
  swapoff /swapfile && sed -i '\#^/swapfile #d' /etc/fstab && rm -f /swapfile /etc/sysctl.d/99-swappiness.conf && sysctl -w vm.swappiness=60
  ```

## 6. Docker daemon settings (log rotation, live-restore, build-cache limit)

```bash
cd ~/ListingLift && git pull origin main
cp ops/server/daemon.json /etc/docker/daemon.json
dockerd --validate --config-file=/etc/docker/daemon.json
```

- Expected: `configuration OK`. (If it prints an error that mentions `builder`, open
  `/etc/docker/daemon.json`, delete the whole `"builder": {...}` block and the comma before it,
  and validate again.)

Install the weekly build-cache cleanup (safety net, only removes build cache older than 3 days):

```bash
cp ops/server/docker-builder-prune /etc/cron.weekly/docker-builder-prune
chmod 755 /etc/cron.weekly/docker-builder-prune
run-parts --test /etc/cron.weekly | grep docker-builder-prune
```

- Expected: `/etc/cron.weekly/docker-builder-prune`.

Restart Docker (all containers restart; ~1-2 min downtime). Measure dockerd memory before/after:

```bash
ps -o rss= -p $(pidof dockerd)          # before, in KB (was ~600000)
systemctl restart docker
sleep 60; docker ps --format '{{.Names}}\t{{.Status}}'
docker info --format 'logging={{.LoggingDriver}} live-restore={{.LiveRestoreEnabled}}'
ps -o rss= -p $(pidof dockerd)          # after
curl -s https://api.peshkarai.in/health
```

- Expected: 12 containers `Up`; `logging=json-file live-restore=true`; dockerd RSS much lower
  (expected well under 200000); health `{"healthy":true,"checks":{"mongo":"ok","redis":"ok"}}`.
- From now on, restarting Docker (e.g. package updates) no longer stops the containers.
- Rollback: `rm /etc/docker/daemon.json /etc/cron.weekly/docker-builder-prune && systemctl restart docker`

## 7. Peshkar: new compose settings (still the current images)

This applies: memory limits, log rotation, Mongo cache cap (0.25 GB) + quiet logs, slower health
checks, re-edit concurrency 2, worker 90 s graceful stop, pinned Caddy. It uses the images you
already have; the slim images come in step 8.

First keep the current images as rollback copies:

```bash
cd ~/ListingLift
docker tag peshkar-server-api-service:latest peshkar-server-api-service:pre-slim
docker tag peshkar-server-worker:latest peshkar-server-worker:pre-slim
docker images | grep peshkar-server
```

- Expected: each image listed twice (`latest` and `pre-slim`, same IMAGE ID).

Apply (MongoDB restarts; the step 3 backup must exist):

```bash
docker compose -f docker-compose.server.yml config --quiet && echo CONFIG-OK
docker compose -f docker-compose.server.yml up -d
sleep 90; docker compose -f docker-compose.server.yml ps
```

Never use `down` here. Verify:

```bash
curl -s https://api.peshkarai.in/health
curl -s https://api.peshkarai.in/ip
docker logs --tail 30 peshkar-server-worker-1 | grep "All BullMQ Workers active"
docker exec peshkar-mongodb sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "print(rs.status().myState, db.serverStatus().wiredTiger.cache[\"maximum bytes configured\"])"'
docker inspect --format '{{.Name}} mem={{.HostConfig.Memory}} log={{.HostConfig.LogConfig.Config}}' $(docker ps -q)
```

- Expected:
  - `ps`: api-service and mongodb `(healthy)`, all `Up`.
  - health: `{"healthy":true,...}`; `/ip` shows **your own** public IP.
  - worker line contains `re-edit x2` (old image: no "assets" yet, that's fine).
  - Mongo prints `1 268435456` (1 = PRIMARY, 268435456 = 256 MB cache).
  - Peshkar containers show `mem=` limits and `max-file:3 max-size:10m`.
- Rollback:
  ```bash
  cp ~/backups/peshkar-compose.$STAMP.yml docker-compose.server.yml
  docker compose -f docker-compose.server.yml up -d
  ```
  (Afterwards `git checkout -- docker-compose.server.yml` to get the repo version back before the next pull.)

## 8. Peshkar: slim images (worker first, then API)

The new API sends card re-rendering and ZIP bundles to the worker, so the **worker must be
updated first**. Build one image at a time.

### 8a. Worker

```bash
cd ~/ListingLift
docker compose -f docker-compose.server.yml build worker
docker images | grep peshkar-server-worker
docker compose -f docker-compose.server.yml up -d --no-deps worker
sleep 20; docker logs --tail 20 peshkar-server-worker-1
```

Verify:

```bash
docker logs peshkar-server-worker-1 2>&1 | grep "All BullMQ Workers active"
docker exec peshkar-server-worker-1 ps -o pid,rss,args
docker exec peshkar-server-worker-1 ls /app/fonts
docker exec peshkar-server-worker-1 node -e "require('sharp'); require('pdfkit'); console.log('deps OK', require('sharp').versions.vips)"
```

- Expected:
  - `latest` is now ~0.3-0.45 GB (the `pre-slim` one stays ~1 GB).
  - `All BullMQ Workers active (generation x3, re-edit x2, assets x1, maintenance every 5 min).`
  - `ps`: `docker-init` + `node dist/index.js`, **no pnpm**.
  - fonts: `Poppins-Bold.ttf ... TiroDevanagariHindi-Regular.ttf` (8 files).
  - `deps OK 8.x.x`.
  - (A harmless `Fontconfig error: Cannot load default config file` line can appear; the old image prints it too.)
- Rollback (worker):
  ```bash
  docker tag peshkar-server-worker:pre-slim peshkar-server-worker:latest
  docker compose -f docker-compose.server.yml up -d --no-deps --force-recreate worker
  ```

### 8b. API

```bash
docker compose -f docker-compose.server.yml build api-service
docker images | grep peshkar-server-api-service
docker compose -f docker-compose.server.yml up -d --no-deps api-service
sleep 30; docker compose -f docker-compose.server.yml ps api-service
curl -s https://api.peshkarai.in/health; echo
curl -s https://api.peshkarai.in/ip; echo
docker exec peshkar-server-api-service-1 node -e "require('sharp'); require('pdfkit'); console.log('deps OK')"
```

- Expected: `(healthy)`, health JSON healthy, your IP, `deps OK`, image ~0.3-0.45 GB.
- **Test in the app** (logged in as a real user):
  1. Quick Generate one listing; cards appear.
  2. On a listing, pick another card template ("Apply template"); the cards re-render in a few seconds.
  3. Download the ZIP bundle.
  4. A re-edit of one image.
  5. If you can, something that makes an invoice/receipt (payment flow).
  6. While doing 2 and 3, watch: `docker logs -f peshkar-server-worker-1 | grep "Asset job"`.
     You should see `Asset job regenerate-cards (...) finished in ...ms` and `Asset job bundle-zip ...`.
- Rollback (API **and** worker together, because the new API needs the new worker):
  ```bash
  docker tag peshkar-server-api-service:pre-slim peshkar-server-api-service:latest
  docker tag peshkar-server-worker:pre-slim peshkar-server-worker:latest
  docker compose -f docker-compose.server.yml up -d --no-deps --force-recreate worker api-service
  ```
  Emergency alternative (keep the new API, work without the worker): add `ASSET_JOBS_INLINE=1` to
  `.env.production` and `docker compose -f docker-compose.server.yml up -d --no-deps api-service`.
  The API then renders cards/ZIPs itself, as before.

## 9. NotebookLM app: limits + secret-free image

```bash
cd ~/NotebookLM-Clone/backend && git pull origin main
docker tag server-application-a-api-service:latest server-application-a-api-service:pre-fix
docker compose -f docker-compose.server.yml config --quiet && echo CONFIG-OK
docker compose -f docker-compose.server.yml build api-service
docker compose -f docker-compose.server.yml up -d
sleep 60; docker compose -f docker-compose.server.yml ps
curl -s -o /dev/null -w '%{http_code}\n' https://chithhi-api.yasho.tech/api/v1/healthcheck
docker exec server-application-a-api-service-1 ls -la /app
docker stats --no-stream
```

- Expected: all `Up`, api `(healthy)`; `200`; `/app` contains only `node_modules package.json shared src`
  (no `.env.bak...`, no `certificates`); NotebookLM containers show limits (512MiB / 768MiB / 320MiB / 64MiB).
- What changed: memory limits, `cpu_shares: 512` (Peshkar gets priority when both are busy; when
  Peshkar is idle NotebookLM can still use all the CPU), log rotation, slower health checks, pinned Caddy.
- Clean up the secret backup file on disk (it is world-readable today) and tighten env permissions:
  ```bash
  mv ~/NotebookLM-Clone/backend/.env.bak.* ~/backups/ && chmod 600 ~/backups/.env.bak.* ~/NotebookLM-Clone/backend/.env ~/ListingLift/.env.production
  ```
  If the old NotebookLM image was ever pushed or shared, rotate the keys that were in that `.env` backup.
- Rollback:
  ```bash
  docker tag server-application-a-api-service:pre-fix server-application-a-api-service:latest
  cp ~/backups/nlm-docker-compose.server.yml.$STAMP docker-compose.server.yml
  docker compose -f docker-compose.server.yml up -d --force-recreate
  ```

## 10. Traefik (shared HTTPS gateway): pinned version, WARN logs, dashboard off

All three sites blink for a few seconds.

```bash
cd ~/NotebookLM-Clone/backend
docker compose -f docker-compose.api-gateway.yml config --quiet && echo CONFIG-OK
docker compose -f docker-compose.api-gateway.yml up -d
sleep 15
docker inspect -f '{{.Config.Image}}' traefik-traefik-1
for u in https://api.peshkarai.in/health https://chithhi-api.yasho.tech/api/v1/healthcheck https://logs.yasho.tech/; do curl -s -o /dev/null -w "%{http_code} $u\n" $u; done
docker logs --tail 20 traefik-traefik-1
```

- Expected: `traefik:v3.7.12`; `200` for the two APIs and `200` for logs; no `level=error` lines
  (WARN level prints very little). Certificates are kept (stored in `certificates/letsencrypt/acme.json`).
- Rollback:
  ```bash
  cp ~/backups/nlm-docker-compose.api-gateway.yml.$STAMP docker-compose.api-gateway.yml
  docker compose -f docker-compose.api-gateway.yml up -d
  ```

## 11. Dozzle (logs.yasho.tech): add a login

Today anyone on the internet can read all container logs. Dozzle's built-in login fixes that.
The user file holds only a bcrypt hash of the password and is gitignored (never committed).

Create the login (choose your own username; the password is typed invisibly, not stored in shell history):

```bash
cd ~/NotebookLM-Clone/backend
mkdir -p dozzle
docker pull amir20/dozzle:v10.7.4
read -rs -p "New Dozzle password: " DZPW; echo
docker run --rm amir20/dozzle:v10.7.4 generate yasho --password "$DZPW" --name "Yasho" --email yashovardhans321@gmail.com > dozzle/users.yml
unset DZPW
chmod 644 dozzle/users.yml
head -4 dozzle/users.yml
git status --short
```

- Expected: `users:` / `yasho:` / `email: ...` / `name: Yasho` (a `password: $2a$...` hash line follows);
  `git status` does **not** list `dozzle/` (it is ignored).

Start Dozzle with login (also pins versions and makes the Docker socket read-only):

```bash
docker compose -f docker-compose.logs.yml config --quiet && echo CONFIG-OK
docker compose -f docker-compose.logs.yml up -d
sleep 10; docker logs --tail 10 backend-dozzle-1
curl -s -o /dev/null -w 'API without login: %{http_code}\n' https://logs.yasho.tech/api/events/stream
```

- Expected: Dozzle log mentions reading `users.yml`; `API without login: 401`.
- Open https://logs.yasho.tech in a browser: you get a **login page**; your username/password works;
  with "remember" you stay logged in 48 h.
- To add or change a user later: re-run the `generate` command (append a second user under `users:`
  by hand, or overwrite the file), then `docker compose -f docker-compose.logs.yml restart dozzle`.
- Rollback:
  ```bash
  cp ~/backups/nlm-docker-compose.logs.yml.$STAMP docker-compose.logs.yml
  docker compose -f docker-compose.logs.yml up -d
  ```
  (That brings back the old, public-without-login version. To simply switch Dozzle off instead:
  `docker compose -f docker-compose.logs.yml stop`. Never add `-v`.)

## 12. Final check and measurements

```bash
free -m; swapon --show; df -h /
docker ps --format '{{.Names}}\t{{.Status}}' | sort
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
ps -o rss=,cmd= -p $(pidof dockerd)
docker system df
sar -u 1 30 | tail -1
```

- Expected (rough): disk ~7-9 GB used; swap 0B used; 12 containers Up; Peshkar api/worker ~100-150 MiB
  each; dockerd well under 200 MB; idle CPU (100 - %idle in the `sar` line) around 5-7%
  (it was ~12-13%). The Hostinger panel CPU graph should drop accordingly over the next hour.

## 13. One week later (if everything is stable)

```bash
docker image rm peshkar-server-api-service:pre-slim peshkar-server-worker:pre-slim server-application-a-api-service:pre-fix
docker image prune -f          # only untagged leftovers; never add -a or --volumes
docker builder prune -af
df -h /
```

Future Peshkar releases (images still built on the server, one at a time):

```bash
cd ~/ListingLift && git pull origin main
docker compose -f docker-compose.server.yml build worker && docker compose -f docker-compose.server.yml up -d --no-deps worker
docker compose -f docker-compose.server.yml build api-service && docker compose -f docker-compose.server.yml up -d --no-deps api-service
```

(If a release changes the compose file, finish with `docker compose -f docker-compose.server.yml up -d`.)

## 14. Security steps (you do these yourself)

### 14a. Change the root password (it was shared in a chat)

```bash
passwd
```

Type a new long password twice. Expected: `passwd: password updated successfully`.
Store it in your password manager. (You can also reset it in hPanel -> VPS -> Settings.)

### 14b. Log in with an SSH key instead of a password

1. **On your laptop** (PowerShell), create a key if you don't have one (press Enter for the default
   path; set a passphrase):
   ```powershell
   ssh-keygen -t ed25519 -C "yasho-laptop"
   ```
2. Copy the public key to the server:
   ```powershell
   type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@93.127.167.18 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
   ```
3. Test in a **new** PowerShell window: `ssh root@93.127.167.18`. It must log in **without asking for
   the root password** (only your key passphrase). Don't continue until this works.

### 14c. Turn off password logins (only after 14b works)

Keep your current SSH session open while doing this.

```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf
sshd -t && systemctl reload ssh
sshd -T | grep -Ei '^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication)'
```

- Expected: `passwordauthentication no`, `kbdinteractiveauthentication no`,
  `permitrootlogin without-password` (same meaning as prohibit-password).
- Test from a new laptop window: `ssh root@93.127.167.18` still works with the key;
  `ssh -o PubkeyAuthentication=no root@93.127.167.18` is refused (`Permission denied (publickey)`).
- Rollback (if locked out, use hPanel -> VPS -> **Browser terminal**):
  ```bash
  rm /etc/ssh/sshd_config.d/10-hardening.conf
  sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config.d/50-cloud-init.conf
  systemctl reload ssh
  ```

### 14d. Firewall (Hostinger panel)

hPanel -> VPS -> **Security -> Firewall** -> create a rule set and activate it:

| Action | Protocol | Port | Source |
|---|---|---|---|
| Accept | TCP | 22 | Any (or only your home IP for extra safety) |
| Accept | TCP | 80 | Any |
| Accept | TCP | 443 | Any |
| Accept | UDP | 443 | Any (optional, HTTP/3) |
| Drop | Any | Any | Any |

- Why the panel and not `ufw`: Docker publishes ports 80/443 itself and bypasses `ufw` rules; the
  panel firewall sits in front of the VPS, so it is the reliable one.
- Verify from your laptop: the three sites load; `ssh root@93.127.167.18` works.
- Rollback: deactivate the rule set in the panel.
- Optional: `apt install fail2ban` to slow down password-guessing bots (less important once 14c is done).

---

## Reference: what changed where

- `ListingLift/docker-compose.server.yml`: limits/reservations, `init: true`, heap caps, `VIPS_CONCURRENCY=1`,
  `WORKER_RE_EDIT_CONCURRENCY=2`, worker `stop_grace_period: 90s`, Mongo `--wiredTigerCacheSizeGB 0.25 --quiet`
  + 768M limit, 60 s / 30 s health checks with fast `start_interval`, log rotation, `caddy:2.11.4`.
  Replica-set flags, keyfile mount, labels, networks and volume names unchanged.
- `ListingLift/apps/api/Dockerfile`, `apps/worker/Dockerfile`: multi-stage; runtime = Node + production
  dependencies + `dist` + fonts (`CARD_FONTS_DIR=/app/fonts`), runs `node dist/index.js` as user `node`.
- `ListingLift/.dockerignore`: no `.env*`, keyfile, web app, docs or tests in the build context.
- `ListingLift/ops/server/daemon.json`, `ops/server/docker-builder-prune`: Docker daemon config + weekly cache cleanup.
- Card re-rendering (`card.regenerateCards`) and ZIP bundles (`download.downloadBundle`) now run in the
  worker on the `assets` queue (1 at a time); the API waits up to 90 s (`ASSET_JOB_TIMEOUT_MS`).
  `ASSET_JOBS_INLINE=1` makes the API do the work itself (local dev without a worker, or emergency).
- `NotebookLM-Clone/backend/docker-compose.server.yml`: limits, `cpu_shares: 512`, log rotation, health-check
  intervals, `caddy:2.11.4`. `docker-compose.api-gateway.yml`: `traefik:v3.7.12`, WARN logs, no dashboard.
  `docker-compose.logs.yml`: Dozzle v10.7.4 with login, read-only Docker socket, `nginx:1.30.6-alpine`.
  `Dockerfile` + `.dockerignore`: no secrets or certificates in the API image.
