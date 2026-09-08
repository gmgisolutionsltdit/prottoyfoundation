# Backups & restore

Two independent things can be "checkpointed": the **code** (a git commit) and
the **database + Storage files** (a GitHub Actions artifact). A restore
request usually means both together.

## Prerequisite

Storage backup/restore (the `transaction-attachments` bucket — receipt and
expense attachments) needs a repo secret that doesn't exist by default:

- **`SUPABASE_SERVICE_ROLE_KEY`** — from the Supabase Dashboard →
  Project Settings → API → `service_role` secret key. Add it under this
  repo's Settings → Secrets and variables → Actions.

Without it, `db-backup.yml`/`db-restore.yml` still work for the database —
the Storage step just warns and skips.

## Creating a checkpoint

- **Code**: create a branch pinned to the current commit —
  `git branch checkpoint/<date>-<short-label> main && git push origin checkpoint/<date>-<short-label>`.
  (Git tags aren't usable for this repo's automation — pushing a tag is
  blocked — so a permanent branch stands in for one.)
- **Database + Storage**: run the `Database backup` workflow
  (`.github/workflows/db-backup.yml`) via `workflow_dispatch` — no inputs
  needed. Produces one artifact, `db-backup-<UTC timestamp>`, containing a
  combined schema+data `.sql` file and the Storage bucket's files, kept 90
  days.

## Restoring

- **Code**: `git checkout <checkpoint-branch>` (or reset `main` to it and
  push, if you want the checkpoint's code back on `main`).
- **Database + Storage**: run the `Database restore (DESTRUCTIVE)` workflow
  (`.github/workflows/db-restore.yml`) via `workflow_dispatch`, with
  `source_run_id` set to the `db-backup.yml` run you want to restore from
  (find it under Actions → Database backup → the run you want; the run ID
  is the number in its URL). Leave `dry_run: true` first to preview what
  would happen with no changes made; re-run with `dry_run: false` once
  you've reviewed it.

This is a **full replace**: current data is wiped and rebuilt to exactly
match the backup's point in time. It automatically takes a fresh backup of
whatever is live *before* touching anything, so a restore is itself
undoable. See the comments at the top of `db-restore.yml` for the exact
mechanics and known limitations (schema changes since the backup, accounts
created/deleted since the backup, tables added since the backup, brief
downtime while it runs).
