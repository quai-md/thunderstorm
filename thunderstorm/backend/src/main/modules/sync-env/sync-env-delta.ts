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
 * Tracks local-newer ids through one backup stream: force-upsert those that appear
 * in the backup, delete the rest after the stream (this env added them).
 */
export class SyncEnvLocalNewerTracker {
	private readonly localNewer: SyncEnv_LocalNewerMap;
	private readonly remaining: SyncEnv_LocalNewerMap;

	constructor(localNewer: SyncEnv_LocalNewerMap) {
		this.localNewer = localNewer;
		this.remaining = {};
		for (const dbKey of Object.keys(localNewer))
			this.remaining[dbKey] = new Set(localNewer[dbKey]);
	}

	isLocalNewer(dbKey: string, id: string): boolean {
		return this.localNewer[dbKey]?.has(id) ?? false;
	}

	markSeen(dbKey: string, id: string): void {
		this.remaining[dbKey]?.delete(id);
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
