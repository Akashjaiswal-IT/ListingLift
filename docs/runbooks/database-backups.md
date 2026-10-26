# Database backups (MongoDB): runbook

This page explains, in plain English, how Peshkar AI's database is backed up, how to set it up once,
how to restore, and what to do when an alert email arrives. Every command is meant to be copied
exactly. Lines starting with `$` are not used; just run the commands as shown.

## 1. What you get

Every hour (at minute 17 UTC) the server runs `scripts/backup/mongo-backup.sh`, which:

1. counts the documents in `users`, `creditledgers`, `payments`, `listingobjects` (the **manifest**);
2. makes a consistent copy of the whole database with `mongodump --oplog --gzip --archive`;
3. keeps a **plain local copy** on the server (newest 24 only);
4. **encrypts** the copy with your age **public** key and uploads it to Cloudflare R2;
5. once a day also uploads a "daily" copy and an encrypted copy of `.env.production` and
   `mongo-keyfile`;
6. tells Healthchecks.io it worked (or failed). Healthchecks.io emails you if it fails or goes quiet.

Once a week a GitHub Actions workflow in your private `peshkar-ops` repo downloads the newest backup,
restores it into a throwaway database and checks it. That workflow emails you (through Healthchecks.io)
if the restore does not work.

| Where | What | How long it is kept | Encrypted | Protects against |
|---|---|---|---|---|
| Server `/var/backups/peshkar/local` | hourly copies | newest 24 (one day) | no (root-only files) | mistakes: deleted/damaged data. Fast restore. |
| R2 `mongodump/hourly/YYYY/MM/DD/` | hourly copies + manifests | 7 days | yes | losing the server, mistakes |
| R2 `mongodump/daily/YYYY/MM/` | one copy per day | 30 days | yes | problems noticed late |
| R2 `config/YYYY/MM/` | `.env.production` + `mongo-keyfile` | 30 days | yes | rebuilding on a new server |

Why it is safe:

- The server only has the age **public** key. It can encrypt but **cannot decrypt**. The private key
  stays offline with you (plus a copy as a GitHub secret for the weekly test).
- R2 **bucket lock rules** stop anyone, even with the server's R2 key, from deleting or overwriting
  a backup before it is 7 days (hourly) or 30 days (daily, config) old. If someone breaks into the
  server, they cannot destroy the off-site backups.
- R2 **lifecycle rules** delete old backups automatically, so storage does not grow forever.

Important: the `backup-before-replset-*.gz` file made by `scripts/enable-mongo-replica-set.sh` sits
**inside the database volume**. It is **not** a backup: if the volume or the server is lost, it is
lost too.

### Words used here

- **age**: a small, modern encryption tool. A **key pair** is a *public key* (`age1...`, safe to
  share, can only lock) and a *private key* (`AGE-SECRET-KEY-1...`, secret, unlocks).
- **R2**: Cloudflare's file storage. A **bucket** is a top-level folder. An **object** is a file in it.
- **rclone**: command-line program that copies files to and from R2.
- **Healthchecks.io**: a service that expects a "ping" on a schedule and emails you when pings stop
  or report failure.
- **oplog**: MongoDB's journal of recent changes. `--oplog` records the changes made *while* the dump
  runs, and `--oplogReplay` re-applies them on restore, so the copy is one exact moment in time.
- **UTC**: world time. India time (IST) = UTC + 5:30. All backup file names use UTC.

### Files in the repo

| File | What it is |
|---|---|
| `scripts/backup/mongo-backup.sh` | the hourly backup (installed as `/usr/local/sbin/peshkar-mongo-backup`) |
| `scripts/backup/backup.env.example` | every setting, with placeholders |
| `scripts/backup/create-backup-user.sh` | creates the least-privilege MongoDB user `peshkar_backup` |
| `scripts/backup/mongo-restore.sh` | restores a plain archive into the Mongo container (asks before doing anything) |
| `scripts/backup/rclone-r2.sh` | runs rclone against the backup bucket using the server's settings |
| `scripts/backup/systemd/peshkar-mongo-backup.{service,timer}` | runs the backup every hour |
| `ops/peshkar-ops/` | template for the private `peshkar-ops` repo (weekly restore test) |

---

## 2. One-time setup

Do the steps in order. Each step says how to undo it.

### 2.1 Make your age key pair (on your own Windows computer, NOT the server)

1. Open PowerShell and install age:
   ```powershell
   winget install --id FiloSottile.age
   ```
   Close and reopen PowerShell, then check: `age --version` prints a version like `v1.2.1`.
2. Create the key pair:
   ```powershell
   age-keygen -o peshkar-backup-key.txt
   ```
   Expected output: `Public key: age1...` (a long line). That `age1...` value is your **public key**.
   You will paste it into the server settings (`AGE_RECIPIENT`).
3. Keep `peshkar-backup-key.txt` safe, in **at least two places**: your password manager (as a
   secure note or attachment) and an offline copy (USB stick in a drawer, or a printout).
   **If you lose this file, every backup is unreadable.** Never put it on the server, never commit
   it, never email it.

Undo: delete the file. Only do this before any backups exist; afterwards it is the only way to read them.

### 2.2 Create the R2 bucket

1. Log in to https://dash.cloudflare.com, pick your account, open **R2 Object Storage** in the left menu.
2. Click **Create bucket**. Name: `peshkar-db-backups` (any name works; use the same name everywhere
   below). Location: **Automatic**. Default storage class: **Standard**. Click **Create bucket**.
3. Do **not** turn on public access (it is off by default). Use this bucket only for backups. Do not
   reuse the bucket that stores app images.

Undo: bucket **Settings > Delete bucket** (only possible once it is empty).

### 2.3 Add the bucket lock rules (nobody can delete fresh backups)

In the bucket, open **Settings**, find **Bucket lock rules** and click **Add rule** three times:

| Rule name | Prefix | Retention |
|---|---|---|
| `lock-hourly-7d` | `mongodump/hourly/` | Age: **7 days** |
| `lock-daily-30d` | `mongodump/daily/` | Age: **30 days** |
| `lock-config-30d` | `config/` | Age: **30 days** |

Type the prefix exactly, including the slash at the end.

Undo: delete the rule in the same place. Only someone logged in to the dashboard (or with an
admin token) can do this. The server's token cannot.

### 2.4 Add the lifecycle rules (old backups are deleted automatically)

Still in the bucket's **Settings**, find **Object lifecycle rules** and click **Add rule** three times:

| Rule name | Prefix | Action |
|---|---|---|
| `expire-hourly-7d` | `mongodump/hourly/` | Delete objects after **7 days** |
| `expire-daily-30d` | `mongodump/daily/` | Delete objects after **30 days** |
| `expire-config-30d` | `config/` | Delete objects after **30 days** |

Leave Cloudflare's default rule (abort incomplete multipart uploads after 7 days) as it is. Old
objects can stay up to about a day past their age before R2 removes them; that is normal.

Undo: delete the rules (storage then grows forever).

### 2.5 Create two R2 API tokens (one writer, one reader)

1. In **R2 Object Storage**, click **Manage API tokens** (on the R2 overview page; it may be labelled
   **API Tokens > Manage**).
2. Click **Create Account API token** (or "Create API token").
3. **Writer, for the server:**
   - Token name: `peshkar-backup-writer-server`
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** > `peshkar-db-backups`
   - TTL: **Forever**
   - (Optional) Client IP address filtering: your server's public IP
   - Click **Create API Token**. Copy the **Access Key ID**, the **Secret Access Key** and the
     **S3 endpoint** (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`) into your password manager now.
     The secret is shown only once.
4. **Reader, for the weekly test (peshkar-ops):** repeat with
   - Token name: `peshkar-backup-reader-drill`
   - Permissions: **Object Read only**
   - Same bucket only, TTL Forever. Copy its Access Key ID and Secret Access Key.

Undo: on the same page, **Delete** a token (or **Roll** it to get a new secret). Anything using the old
one stops working.

### 2.6 Healthchecks.io: two checks with email alerts

1. Sign up at https://healthchecks.io (free plan). Your login email automatically gets an **Email**
   notification method. Confirm it under **Integrations**: you should see "Email" with your address;
   click **Test!** and check that a test email arrives (look in spam the first time and mark it
   "not spam").
2. Click **Add Check**. Name: `peshkar hourly backup`. Click the schedule ("Change Schedule..."),
   choose **Cron**, expression `17 * * * *`, time zone **UTC**, grace time **30 minutes**. Save.
   Copy its **ping URL** (`https://hc-ping.com/<uuid>`) to your password manager.
3. **Add Check** again. Name: `peshkar weekly restore test`. Cron `43 4 * * 1`, time zone **UTC**,
   grace time **6 hours** (GitHub sometimes starts scheduled runs late). Copy its ping URL.
4. Open each check and make sure the **Email** integration is switched on for it.

How alerts reach you:

- **When:** within about a minute of a failed backup (the script sends `/fail`); or when no success
  arrives by about :47 past the hour (hourly check: schedule + 30 min grace); or when the weekly test
  fails or does not run by Monday ~10:43 UTC.
- **What it looks like:** an email from Healthchecks.io whose subject starts with **DOWN** and names
  the check, e.g. "DOWN | peshkar hourly backup". The body shows the last ping; for a failed backup
  the ping body says what failed, e.g.
  `server1 peshkar-mongo-backup FAILED: disk / is 93% full (limit 90%); free some space`.
- When things work again you get an **UP** email.
- The ping URLs are a little secret: anyone with them could send fake pings. Keep them in the
  password manager and the settings file only.

Undo: delete the checks (you then get no alerts).

### 2.7 Install the tools on the server

```bash
sudo apt-get update
sudo apt-get install -y age rclone jq curl
age --version && rclone version | head -1 && jq --version
```

Expected: three version lines, e.g. `1.1.1`, `rclone v1.60.1-DEV`, `jq-1.7.1`. (rclone 1.59 or newer
is needed for Cloudflare R2; Ubuntu 24.04 ships 1.60.)

Undo: `sudo apt-get remove age rclone` (keep jq and curl; other things may use them).

### 2.8 Create the settings file `/etc/peshkar-backup/backup.env`

On the server, in the app folder (where `docker-compose.server.yml` is):

```bash
cd /path/to/ListingLift                     # your app folder
pwd                                         # note this path for APP_DIR
openssl rand -hex 32                        # note this: the backup user's password
sudo install -d -m 700 /etc/peshkar-backup
sudo install -m 600 scripts/backup/backup.env.example /etc/peshkar-backup/backup.env
sudo nano /etc/peshkar-backup/backup.env
```

In the editor, replace every placeholder:

| Setting | Value |
|---|---|
| `APP_DIR` | the path printed by `pwd` |
| `MONGO_DB` | the database name (`MONGO_INITDB_DATABASE` in `.env.production`, normally `peshkar`) |
| `MONGO_BACKUP_PASSWORD` | the `openssl rand -hex 32` output |
| `AGE_RECIPIENT` | your **public** key `age1...` from step 2.1 (never the `AGE-SECRET-KEY`) |
| `R2_BUCKET` | `peshkar-db-backups` |
| `RCLONE_CONFIG_R2_ACCESS_KEY_ID` / `..._SECRET_ACCESS_KEY` | the **writer** token from 2.5 |
| `RCLONE_CONFIG_R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `HC_PING_URL` | ping URL of "peshkar hourly backup" |

Save with Ctrl+O, Enter, Ctrl+X. Check the permissions:

```bash
sudo stat -c '%a %U' /etc/peshkar-backup/backup.env
```

Expected: `600 root`. The backup refuses to run if other users can read this file. Also save a copy
of the finished file in your password manager (you need it to rebuild a server).

Undo: `sudo rm -r /etc/peshkar-backup`

### 2.9 Create the MongoDB backup user

```bash
cd /path/to/ListingLift
sudo bash scripts/backup/create-backup-user.sh
```

Expected: `Created MongoDB user peshkar_backup (roles: backup, clusterMonitor)`. (Running it again
prints `Updated ...`; that is fine, e.g. after changing the password in `backup.env`.) The user can
read everything for a backup but cannot change or delete data.

Undo: `sudo bash scripts/backup/create-backup-user.sh --remove`

### 2.10 Install the backup script and the hourly timer

```bash
cd /path/to/ListingLift
sudo install -m 700 scripts/backup/mongo-backup.sh /usr/local/sbin/peshkar-mongo-backup
sudo install -m 644 scripts/backup/systemd/peshkar-mongo-backup.service /etc/systemd/system/
sudo install -m 644 scripts/backup/systemd/peshkar-mongo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

No output means success. (Do not enable the timer yet.) When the script changes in a future
`git pull`, run the first `install` line again.

Undo:
```bash
sudo systemctl disable --now peshkar-mongo-backup.timer
sudo rm /etc/systemd/system/peshkar-mongo-backup.{service,timer} /usr/local/sbin/peshkar-mongo-backup
sudo systemctl daemon-reload
```

### 2.11 First manual run

`FORCE_DAILY=1` also makes the daily copy and the config copy right away, so everything is tested:

```bash
sudo env FORCE_DAILY=1 /usr/local/sbin/peshkar-mongo-backup
```

Expected output (times, sizes and counts will differ):
```
2026-10-26T09:25:49Z disk / 41% used
2026-10-26T09:25:58Z document counts: {"users":...,"creditledgers":...,"payments":...,"listingobjects":...}
2026-10-26T09:25:58Z dumping to /var/backups/peshkar/local/peshkar-mongo-20261026T092548Z.archive.gz
2026-10-26T09:26:05Z local copy saved (... KiB, sha256 ced0133ecefe...)
2026-10-26T09:26:05Z removed 0 old local copies; 1 kept
2026-10-26T09:26:08Z uploaded to mongodump/hourly/2026/10/26/
2026-10-26T09:26:09Z uploaded to mongodump/daily/2026/10/
2026-10-26T09:26:10Z uploaded config files to config/2026/10/
2026-10-26T09:26:10Z OK peshkar-mongo-20261026T092548Z.archive.gz ... KiB uploaded:hourly+daily+config local_copies:1 counts:{...}
```

If it prints `ERROR: ...`, the message says what is wrong (see section 6). Nothing is half-done:
just fix it and run again.

Now run it once the way systemd will:
```bash
sudo systemctl start peshkar-mongo-backup.service
journalctl -u peshkar-mongo-backup.service -n 20 --no-pager
```
Expected: the same kind of lines ending with `OK ...` and `Finished peshkar-mongo-backup.service`.

### 2.12 Turn on the hourly timer

```bash
sudo systemctl enable --now peshkar-mongo-backup.timer
systemctl list-timers peshkar-mongo-backup.timer
```

Expected: one line whose NEXT column is the next hour at about :17 (UTC). The server time zone
does not matter; the timer uses UTC.

Undo: `sudo systemctl disable --now peshkar-mongo-backup.timer`

### 2.13 Check that it works

1. Local copies: `sudo ls -l /var/backups/peshkar/local/` shows `peshkar-mongo-<time>.archive.gz` and
   `.manifest.json` files with `-rw-------` and owner `root`.
2. R2: dashboard > R2 > `peshkar-db-backups` > Objects. You should see `mongodump/hourly/<year>/<month>/<day>/`
   with two `.age` files per run, `mongodump/daily/...` and `config/...`. Or on the server:
   ```bash
   cd /path/to/ListingLift
   sudo bash scripts/backup/rclone-r2.sh lsf -R mongodump/
   ```
3. Healthchecks.io: "peshkar hourly backup" is green ("up"); its event log shows "start" and
   "success" with the `OK ...` message.
4. After the next hour passes, step 1 shows one more file. After 24 hours there are always 24.

### 2.14 Check that the lock really protects backups

Upload a small test file into the hourly folder and try to delete it with the server's token:

```bash
cd /path/to/ListingLift
echo "lock test" | sudo bash scripts/backup/rclone-r2.sh rcat mongodump/hourly/lock-test.txt
sudo bash scripts/backup/rclone-r2.sh deletefile mongodump/hourly/lock-test.txt
```

Expected: the first command prints nothing (success). The **second must fail** with an error
(a 403 / "AccessDenied" / "locked" style message). The file stays for 7 days and is then removed by
the lifecycle rule; it does not disturb anything (the weekly test only looks at `.archive.gz.age` files).

If the delete **succeeds**, the lock rule is missing or its prefix is wrong: go back to 2.3.

### 2.15 Set up the weekly restore test

Follow `ops/peshkar-ops/README.md`: create the private repo `peshkar-ops`, copy the files in, add the
six secrets (read-only token, bucket, endpoint, age private key, weekly Healthchecks URL), and run it
once by hand. It should end with `PASS: restore drill complete`.

---

## 3. Restore from a local copy (server is fine, data was damaged or deleted)

Use this when the server works but something in the database is wrong (bad deploy, deleted data).
The local copies cover the last 24 hours.

1. **Pause the hourly backup**, so it does not rotate away the copy you want:
   ```bash
   sudo systemctl stop peshkar-mongo-backup.timer
   ```
2. **Pick the copy** from just before the problem. Names are UTC (IST minus 5:30):
   ```bash
   sudo ls -l /var/backups/peshkar/local/
   ```
3. **Set it aside** (with its manifest) so nothing deletes it:
   ```bash
   sudo install -d -m 700 /root/peshkar-restore
   sudo cp -p /var/backups/peshkar/local/peshkar-mongo-<TIME>.* /root/peshkar-restore/
   ```
4. **Take a safety backup of the current state** (this is your undo):
   ```bash
   sudo systemctl start peshkar-mongo-backup.service
   ```
5. **Stop the app** so nothing writes during the restore:
   ```bash
   cd /path/to/ListingLift
   docker compose -f docker-compose.server.yml stop api-service worker
   ```
6. **Restore:**
   ```bash
   sudo bash scripts/backup/mongo-restore.sh /root/peshkar-restore/peshkar-mongo-<TIME>.archive.gz
   ```
   It checks the checksum, shows what it will do, and asks you to type `RESTORE`. The last lines are:
   ```
   ... replaying oplog
   ... applied N oplog entries
   Restore finished. Start the app again:
   ```
7. **Start the app and check it:**
   ```bash
   docker compose -f docker-compose.server.yml start api-service worker
   curl -s -o /dev/null -w '%{http_code}\n' https://api.peshkarai.in/health
   ```
   Expected `200`. Log in to the website and check the data looks right.
8. **Turn backups back on** and tidy up:
   ```bash
   sudo systemctl start peshkar-mongo-backup.timer
   sudo rm -r /root/peshkar-restore
   ```

Undo the restore: repeat steps 5-7 with the safety backup from step 4 (the newest file in
`/var/backups/peshkar/local/` from before the restore).

What the restore does and does not do:

- It **replaces** each collection that is in the backup (`--drop`). Collections created after the
  backup was taken are left alone. Everything written after the backup time is lost.
- It also restores MongoDB's own users (admin database), so their passwords go back to what they
  were at backup time. Normally nothing changes.
- `--app-db-only` restores only the app database and leaves MongoDB's users alone. MongoDB cannot
  combine this with oplog replay, so writes made during the few seconds of the dump may be missing.
  Use it only if the full restore is not suitable (e.g. you changed the root password since):
  ```bash
  sudo bash scripts/backup/mongo-restore.sh /root/peshkar-restore/peshkar-mongo-<TIME>.archive.gz --app-db-only
  ```
- Redis (queues, rate limits) is not backed up. It only holds short-lived data.

## 4. Restore from R2 (local copies are gone or too new)

The decryption happens on **your computer**, because only you have the private key.

1. **Download** the archive and its manifest. Easiest: Cloudflare dashboard > R2 >
   `peshkar-db-backups` > Objects > open `mongodump/hourly/<y>/<m>/<d>/` (last 7 days) or
   `mongodump/daily/<y>/<m>/` (last 30 days) > click the file > **Download**. Get both
   `peshkar-mongo-<TIME>.archive.gz.age` and `peshkar-mongo-<TIME>.manifest.json.age`.
2. **Decrypt** in PowerShell, in the folder with the downloads and your key file:
   ```powershell
   age -d -i peshkar-backup-key.txt -o peshkar-mongo-<TIME>.archive.gz peshkar-mongo-<TIME>.archive.gz.age
   age -d -i peshkar-backup-key.txt -o peshkar-mongo-<TIME>.manifest.json peshkar-mongo-<TIME>.manifest.json.age
   ```
   No output means success. `no identity matched any of the recipients` means the wrong key file.
   (Note: the `.archive.gz` is a MongoDB archive, not a normal zip; you cannot open it with unzip.)
3. **Copy to the server** (scp is built into Windows):
   ```powershell
   scp peshkar-mongo-<TIME>.archive.gz peshkar-mongo-<TIME>.manifest.json <user>@<server>:/tmp/
   ```
   Then on the server:
   ```bash
   sudo install -d -m 700 /root/peshkar-restore
   sudo mv /tmp/peshkar-mongo-<TIME>.* /root/peshkar-restore/
   sudo chmod 600 /root/peshkar-restore/*
   ```
4. **Restore** with steps 1, 4, 5, 6, 7, 8 of section 3, using the file in `/root/peshkar-restore/`.
5. **Delete the decrypted files on your computer** (`Remove-Item peshkar-mongo-<TIME>.archive.gz,
   peshkar-mongo-<TIME>.manifest.json`). Keep only the encrypted ones, if anything.

## 5. Monthly check (about 10 minutes)

1. Healthchecks.io: both checks green. Event log of the hourly check shows a success every hour.
2. GitHub > `peshkar-ops` > Actions: the last "Restore drill" runs are green.
3. R2 bucket: `mongodump/hourly/` has only about the last 7 days, `mongodump/daily/` and `config/`
   about the last 30 days (proves the lifecycle rules work). Bucket lock rules and lifecycle rules
   are still listed in **Settings**.
4. **Prove your key still works:** download the newest `config/<y>/<m>/peshkar-config-<TIME>.tar.gz.age`
   and in PowerShell:
   ```powershell
   age -d -i peshkar-backup-key.txt -o cfg.tar.gz peshkar-config-<TIME>.tar.gz.age
   tar -tzf cfg.tar.gz
   Remove-Item cfg.tar.gz, peshkar-config-<TIME>.tar.gz.age
   ```
   Expected: `.env.production` and `mongo-keyfile` listed.
5. Server disk: `df -h /` below 80% "Use%". Local copies: `sudo ls /var/backups/peshkar/local | wc -l`
   shows 48 (24 archives + 24 manifests).
6. Your key file is still in both places (password manager + offline copy).

## 6. When an alert email arrives

### "DOWN | peshkar hourly backup"

1. Open the email or the check on Healthchecks.io. If it was a `/fail` ping, the message says what
   failed. If there was no ping at all, the server may be down or the timer off.
2. On the server:
   ```bash
   journalctl -u peshkar-mongo-backup.service -n 50 --no-pager
   systemctl list-timers peshkar-mongo-backup.timer
   ```
3. Fix by message:

| Message contains | What to do |
|---|---|
| `disk / is NN% full` | Free space: `docker image prune -a` and `docker builder prune` (never `docker volume prune` or `docker compose down -v`). Check `df -h /`. |
| `container peshkar-mongodb is not running` | `docker compose -f docker-compose.server.yml up -d mongodb`, then check the app. |
| `counting documents` + `Authentication failed` | The backup user's password does not match: `sudo bash scripts/backup/create-backup-user.sh` |
| `uploading` + `403` / `Forbidden` / `InvalidAccessKeyId` | The writer R2 token was deleted, rolled or limited. Make a new one (2.5) and update `backup.env`. |
| `settings file ... readable by other users` | `sudo chmod 600 /etc/peshkar-backup/backup.env` |
| `required program 'X' is not installed` | `sudo apt-get install -y X` |
| `another backup run is still in progress` | A run is stuck: `systemctl status peshkar-mongo-backup.service`; it is stopped after 30 minutes. |
| no ping, timer not listed | `sudo systemctl enable --now peshkar-mongo-backup.timer` |
| no ping, server unreachable | Fix the server first; the timer catches up after boot (`Persistent=true`). |

4. After fixing, run `sudo systemctl start peshkar-mongo-backup.service`. You get an **UP** email.

### "DOWN | peshkar weekly restore test"

Open GitHub > `peshkar-ops` > Actions > the failed "Restore drill" run and read the `FAIL:` line.
The table in `ops/peshkar-ops/README.md` says what each one means. Most common:
`newest backup is older than 3 hours` means the hourly backups stopped (see above). After fixing,
re-run with **Run workflow**.

## 7. Rebuild everything on a new server

Use this if the server is lost.

1. Create an Ubuntu 24.04 VM, install Docker, and set up Traefik and the `peshkar-network` Docker
   network the same way as on the old server.
2. Get the code:
   ```bash
   git clone https://github.com/Akashjaiswal-IT/ListingLift.git
   cd ListingLift
   ```
3. Get the config files. On your computer, download the newest `config/<y>/<m>/peshkar-config-<TIME>.tar.gz.age`,
   then in PowerShell:
   ```powershell
   age -d -i peshkar-backup-key.txt -o cfg.tar.gz peshkar-config-<TIME>.tar.gz.age
   tar -xzf cfg.tar.gz
   scp .env.production mongo-keyfile <user>@<new-server>:<path>/ListingLift/
   Remove-Item cfg.tar.gz, .env.production, mongo-keyfile
   ```
   On the server, in the `ListingLift` folder:
   ```bash
   chmod 600 .env.production
   sudo chown 999:999 mongo-keyfile && sudo chmod 400 mongo-keyfile
   ```
4. Start MongoDB and make it a replica set (it is empty at this point):
   ```bash
   docker compose -f docker-compose.server.yml up -d mongodb
   bash scripts/enable-mongo-replica-set.sh
   ```
   Expected at the end: `Replica set rs0 is PRIMARY.` (Ignore the "Done. Now:" hints; `MONGODB_URI`
   in the restored `.env.production` already has `replicaSet=rs0`.)
5. Restore the newest backup with section 4 (download, decrypt, copy, then
   `sudo bash scripts/backup/mongo-restore.sh /root/peshkar-restore/<file>.archive.gz`).
   The database is empty, so a full restore gives an exact copy.
6. Start everything:
   ```bash
   docker compose -f docker-compose.server.yml build api-service worker
   docker compose -f docker-compose.server.yml up -d
   ```
7. If the server's IP changed, update the DNS record of `api.peshkarai.in`. Check
   `https://api.peshkarai.in/health` returns 200 and log in to the site.
8. Set up backups again: steps 2.7 to 2.14 (use the `backup.env` copy from your password manager;
   the R2 bucket, tokens, Healthchecks checks and peshkar-ops stay as they are). Run
   `create-backup-user.sh` even if the user came back with the restore.

## 8. Turn backups off completely

```bash
sudo systemctl disable --now peshkar-mongo-backup.timer
sudo rm /etc/systemd/system/peshkar-mongo-backup.{service,timer} /usr/local/sbin/peshkar-mongo-backup
sudo systemctl daemon-reload
cd /path/to/ListingLift && sudo bash scripts/backup/create-backup-user.sh --remove
sudo rm -r /etc/peshkar-backup /var/backups/peshkar
```

Then delete the two R2 tokens and pause the Healthchecks checks. Backups in R2 expire by themselves.

## 9. Costs (rough)

R2 charges about US$0.015 per GB per month above the 10 GB free tier, and nothing for downloads.
With a 100 MB compressed backup, 7 days of hourly copies (168) plus 30 daily copies is about 20 GB,
roughly US$0.15 per month. Healthchecks.io and the GitHub Actions minutes used here are free.
