# Fast Env Sync — Spec

Change-tracked, resumable sync of one env's DB into another (e.g. prod → local). Replaces the
brute-force "stream the whole backup and overwrite everything" path with a delta apply that upserts
only what changed, mirrors deletions, and survives the serverless function time limit.

## Scope & ownership

Thunderstorm-only. All logic lives in `ModuleBE_SyncEnv` (backend), `sync-env/apis.ts` (shared
contract), and `ModuleFE_SyncEnvV2` (frontend). Built purely on two existing infra modules — no
artifact/domain coupling:

- `ModuleBE_BackupDocDB` — backups (latest backup descriptor + signed URLs to stream the CSV).
- `ModuleBE_SyncManager` — tombstones (docs deleted at the source).

Consumed by the generic ATS Sync-Env screen and a defaulted KM App-Tools button.

## Core model

- **Watermark** — `EnvSyncIndicator { backupTimestamp, syncTimestamp }`, per source env, in RTDB at
  `/state/ModuleBE_SyncEnv/lastSync/{env}` (via `ModuleBE_Firebase.createModuleStateFirebaseRef`).
  `backupTimestamp` is the source backup timestamp last **fully** applied; the next delta upserts only
  docs whose `__updated` exceeds it. Advanced **only on successful completion**, so a failure never
  creates a silent gap.
- **Delta apply** — stream the source backup CSV; upsert only rows newer than the watermark; skipped
  rows are never read or written (this is what makes repeat syncs cheap). Produces a per-dbKey
  `SyncEnvDeltaSummary { upserted, deleted, skipped }`.
- **Deletions (optional)** — source tombstones since the watermark are fetched from the source and
  batch-deleted locally, scoped to the selected modules. Gated by a `deleteMissing` flag.

## APIs (`ApiDef_SyncEnv.vv1`)

- **`getLatestBackupDelta`** — *source-side (runs on the env being synced FROM).* Returns the latest
  backup descriptor (signed URLs) + tombstones deleted since the caller's watermark. One round trip
  covers upserts and deletes. Cheap; not time-bound.
- **`syncLatestFromEnv`** — *local trigger.* Reads the watermark → calls the source's
  `getLatestBackupDelta` → runs the resumable delta apply → advances the watermark on completion.
  **Fails fast** if the source env does not expose `getLatestBackupDelta` (it must be deployed to prod
  first).
- **`getSyncStatus({env})`** — returns the live `SyncProgress` (or none) so the UI can show an
  in-progress sync and offer Resume.

## Resumability & tracking (the time-limit solution)

Every route runs inside a single gen2 HTTPS function (hard ceiling 60 min). The whole apply runs
inline, so a large apply — especially the first sync (watermark 0 = full import) — can be killed
mid-flight. The CSV **row index** is a stable resume cursor: a backup is a fixed snapshot, so row
order is identical across re-streams.

- **`SyncProgress`** per env at `/state/ModuleBE_SyncEnv/syncProgress/{env}`:
  `{ env, backupId, backupTimestamp, rowIndex, status: 'in-progress'|'completed'|'failed',
  deletesApplied, startedAt, updatedAt, summary?, error? }`.
- **Cursor = absolute CSV rows consumed** (not upserts). Every **1000 rows**: commit the pending write
  batch, *then* persist `rowIndex` — the cursor never runs ahead of committed writes, so even a hard
  timeout-kill is recoverable.
- **Resume** — `syncLatestFromEnv` detects an `in-progress` record on the **same backup** and continues
  from `rowIndex` (skips already-consumed rows); otherwise starts fresh at row 0. Deletes run after the
  upsert pass and flip `deletesApplied` so a resume never redoes them. `forceFull` clears progress and
  restarts at row 0 / watermark 0. Resume is **manual from the UI**.
- **Timeout bump (secondary)** — raise the shared function `timeoutSeconds`/memory to reduce the number
  of resume hops. Correctness comes from the cursor, not the timeout.

## Constraints

- **Backwards compatible** — the local client works against current prod; the delta path is opt-in and
  the brute-force path is untouched. The full delta-with-deletes flow needs the source API deployed to
  prod first.
- **Runtime state, not entities** — watermark and progress live under `/state/...`; they are never
  part of a backup.
- **Env guards** — never sync a non-prod source into prod; honor `allowSyncEnv` / `allowedEnvsToSyncFrom`.

## Status

- **Done** — delta engine + watermark; `getLatestBackupDelta` + `syncLatestFromEnv`; ATS
  `delta`/`deleteMissing`/`forceFull` toggles. (Note: on the legacy `backupId` path `deleteMissing` is a
  no-op — tombstones only flow through `syncLatestFromEnv`.)
- **Remaining** — `SyncProgress` cursor + resume + `getSyncStatus`; expose the new methods on
  `ModuleFE_SyncEnvV2`; point the ATS "fast sync" action at `syncLatestFromEnv`; KM App-Tools button;
  tests for `collectDeletedDocsSince` + the apply orchestration; deploy the source API to prod.
