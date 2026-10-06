import {SyncEnv_DeletedDocRef, SyncEnvDeltaSummary} from '@nu-art/thunderstorm-shared';

/**
 * Pure decision + accounting core for a watermark-based delta apply. It holds the watermark and the
 * running per-dbKey summary; callers (the Firestore writer and the delete pass) ask it whether a
 * candidate should be applied and it records the outcome. Deliberately free of Firestore/stream
 * concerns so the watermark semantics can be unit-tested in isolation.
 */
export class SyncEnvDeltaSummaryBuilder {
	private readonly watermark: number;
	readonly summary: SyncEnvDeltaSummary = {};

	constructor(watermark: number) {
		this.watermark = watermark;
	}

	private bucket(dbKey: string) {
		return this.summary[dbKey] ??= {upserted: 0, deleted: 0, skipped: 0};
	}

	/**
	 * Decide whether an upsert candidate should be written, tallying the outcome.
	 * Strictly-newer than the watermark wins. `force` writes even when the source
	 * doc is stale (local-newer revert: take the backup row anyway).
	 * @returns true when the doc should be written locally, false when it is skipped as stale.
	 */
	considerUpsert(dbKey: string, updated: number, force?: boolean): boolean {
		if (force || updated > this.watermark) {
			this.bucket(dbKey).upserted++;
			return true;
		}

		this.bucket(dbKey).skipped++;
		return false;
	}

	recordDelete(dbKey: string): void {
		this.bucket(dbKey).deleted++;
	}
}

/** Local docs this env changed after the watermark, keyed by dbKey. */
export type SyncEnv_LocalNewerMap = { [dbKey: string]: Set<string> };

/**
 * Tracks locally diverged ids through one backup stream.
 * `force` ids are taken from the backup even when stale (edits + local deletes).
 * `leftover` (defaults to `force`) is what gets deleted after the stream if never seen
 * — pass only still-existing local-newer ids so already-deleted rows are not re-deleted.
 */
export class SyncEnvLocalNewerTracker {
	private readonly force: SyncEnv_LocalNewerMap;
	private readonly remaining: SyncEnv_LocalNewerMap;
	private readonly seenIds: SyncEnv_LocalNewerMap = {};

	constructor(force: SyncEnv_LocalNewerMap, leftover?: SyncEnv_LocalNewerMap) {
		this.force = force;
		this.remaining = {};
		const seed = leftover ?? force;
		for (const dbKey of Object.keys(seed))
			this.remaining[dbKey] = new Set(seed[dbKey]);
	}

	isLocalNewer(dbKey: string, id: string): boolean {
		return this.force[dbKey]?.has(id) ?? false;
	}

	markSeen(dbKey: string, id: string): void {
		(this.seenIds[dbKey] ??= new Set()).add(id);
		this.remaining[dbKey]?.delete(id);
	}

	wasSeen(dbKey: string, id: string): boolean {
		return this.seenIds[dbKey]?.has(id) ?? false;
	}

	unseen(): SyncEnv_DeletedDocRef[] {
		const refs: SyncEnv_DeletedDocRef[] = [];
		for (const dbKey of Object.keys(this.remaining)) {
			for (const id of this.remaining[dbKey])
				refs.push({__collectionName: dbKey, __docId: id});
		}
		return refs;
	}
}
