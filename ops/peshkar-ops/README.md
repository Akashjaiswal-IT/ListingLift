# peshkar-ops: weekly restore drill

This **private** repository runs one GitHub Actions workflow, `Restore drill`, every Monday at
04:43 UTC (10:13 India time). It proves that the Peshkar AI database backups can really be restored:

1. starts a throwaway MongoDB 7 (single-node replica set `rs0`) on the GitHub runner;
2. downloads the newest **hourly** backup from Cloudflare R2 with a **read-only** token, and fails
   if that backup is more than 3 hours old (which would mean hourly backups have stopped);
3. decrypts it with your age private key (stored as a secret; written to a temp file only during
   the decrypt step and deleted at the end of that step);
4. restores it with `mongorestore --archive --gzip --oplogReplay --drop`;
5. checks the archive checksum and the document counts against the manifest written at backup time;
6. pings a Healthchecks.io check, so you get an email if the drill fails or does not run.

The log only shows `PASS:` / `FAIL:` lines. It never prints data, document counts or secrets.
Tool output (rclone, age, mongorestore) is thrown away because error messages can quote data.

The template for these files lives in the public app repo under `ops/peshkar-ops/`. The full backup
guide is `docs/runbooks/database-backups.md` in the app repo.

## Files

```
.github/workflows/restore-drill.yml   the workflow (schedule + manual "Run workflow" button)
scripts/restore-drill.sh              the drill itself, one sub-command per workflow step
README.md                             this file
```

## Setup (once, about 10 minutes)

You need: the R2 **read-only** token, the Healthchecks.io **weekly restore test** ping URL, and your
age private key file (`peshkar-backup-key.txt`). See the runbook for how to create each one.

1. **Create the private repository.** On github.com click **+ > New repository**. Name it
   `peshkar-ops`, choose **Private**, tick nothing else, and click **Create repository**.
   (Or in a terminal: `gh repo create peshkar-ops --private`.)
2. **Copy the three files in.** In PowerShell, from the folder that contains `ListingLift`:
   ```powershell
   git clone https://github.com/<your-github-name>/peshkar-ops.git
   Copy-Item -Recurse -Force ListingLift\ops\peshkar-ops\.github peshkar-ops\
   Copy-Item -Recurse -Force ListingLift\ops\peshkar-ops\scripts peshkar-ops\
   Copy-Item -Force ListingLift\ops\peshkar-ops\README.md peshkar-ops\
   cd peshkar-ops
   git add .
   git update-index --chmod=+x scripts/restore-drill.sh
   git commit -m "Add weekly restore drill"
   git push
   ```
3. **Add the repository secrets.** In the repo: **Settings > Secrets and variables > Actions >
   New repository secret**. Add each one exactly as named:

   | Secret name | What to paste |
   |---|---|
   | `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (shown when you create the R2 token) |
   | `R2_BUCKET` | the backup bucket name, e.g. `peshkar-db-backups` |
   | `R2_READ_ACCESS_KEY_ID` | Access Key ID of the **read-only** R2 token |
   | `R2_READ_SECRET_ACCESS_KEY` | Secret Access Key of the **read-only** R2 token |
   | `AGE_PRIVATE_KEY` | the whole content of `peshkar-backup-key.txt` (the 3 lines, including the `AGE-SECRET-KEY-1...` line) |
   | `HC_DRILL_PING_URL` | ping URL of the Healthchecks.io check "peshkar weekly restore test", e.g. `https://hc-ping.com/<uuid>` |

   Never use the server's **write** token here. The drill only needs to read.
4. **Run it once by hand.** Go to **Actions > Restore drill > Run workflow > Run workflow**. After
   about 3-5 minutes the run should be green. Open the "Restore with --oplogReplay..." step; you
   should see:
   ```
   PASS: archive checksum matches the manifest
   PASS: mongorestore --archive --gzip --oplogReplay --drop completed
   PASS: collection creditledgers restored with the expected number of documents
   PASS: collection listingobjects restored with the expected number of documents
   PASS: collection payments restored with the expected number of documents
   PASS: collection users restored with the expected number of documents
   PASS: restore drill complete
   ```
   and the Healthchecks.io check "peshkar weekly restore test" turns green.

## When it fails

You get an email from Healthchecks.io (subject starting with **DOWN**). GitHub usually emails
you too ("Run failed: Restore drill"). Open the failed run and look for the `FAIL:` line:

| FAIL line | Meaning / what to do |
|---|---|
| `newest backup is older than 3 hours` | Hourly backups on the server stopped. Follow "Backup alert" in the runbook. |
| `could not list backups in R2` / `could not download` | The read-only token is wrong, expired or deleted. Create a new one, update the two `R2_READ_*` secrets. |
| `could not decrypt` | `AGE_PRIVATE_KEY` does not match the public key in the server's `AGE_RECIPIENT`. Fix whichever is wrong. |
| `archive checksum does not match` | The file was damaged. Re-run the workflow; if it fails again, tell someone who knows MongoDB and check the server's local copies. |
| `mongorestore --oplogReplay failed` | The backup could not be restored. Treat as serious: run the drill again; restore a local copy into a test container (runbook). |
| `collection X has fewer documents than the manifest` | Rare: data was deleted during the few seconds of the dump. Re-run; if it repeats, investigate. |
| `could not start` / `did not become PRIMARY` | Problem on GitHub's side. Re-run the workflow. |

To re-run: **Actions > Restore drill > Run workflow**.

## Good to know

- Keep this repository **private** and your GitHub account protected with 2-factor login: the
  `AGE_PRIVATE_KEY` secret can decrypt every backup.
- To rotate the age key: make a new key pair, put the new public key in the server's
  `AGE_RECIPIENT` (you can list old and new, separated by a space, during the change), update
  `AGE_PRIVATE_KEY` here. Keep the old private key until the old backups have expired (30 days).
- Each run uses a few minutes of the free GitHub Actions minutes for private repositories.
