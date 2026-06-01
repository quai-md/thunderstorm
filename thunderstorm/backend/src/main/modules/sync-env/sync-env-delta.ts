import {SyncEnvDeltaSummary} from '@nu-art/thunderstorm-shared';

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
	 * Decide whether an upsert candidate is newer than the watermark, tallying the outcome.
	 * Strictly-newer wins: a doc whose `__updated` equals the watermark was already applied and is skipped.
	 * @returns true when the doc should be written locally, false when it is skipped as stale.
	 */
	considerUpsert(dbKey: string, updated: number): boolean {
		if (updated > this.watermark) {
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
