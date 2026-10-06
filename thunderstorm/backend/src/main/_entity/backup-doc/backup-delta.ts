import {BackupMetaData} from '@nu-art/thunderstorm-shared';
import {currentTimeMillis} from '@nu-art/ts-common';
import {Transform} from 'stream';


export type BackupDelta_NewerMap = { [dbKey: string]: Map<string, any> };
export type BackupDelta_DeletedMap = { [dbKey: string]: Set<string> };

type BackupCsvRow = { dbKey: string, _id: string, document: string };

/**
 * Rewrites last-backup CSV rows into a new full snapshot: drop locally deleted ids,
 * overlay docs newer than the last backup timestamp, copy the rest, then append creates.
 */
export class DeltaBackupRewriter
	extends Transform {

	private readonly allowedDbKeys: Set<string>;
	private readonly newer: BackupDelta_NewerMap;
	private readonly deleted: BackupDelta_DeletedMap;
	private readonly versions: { [dbKey: string]: string };
	private readonly metadata: BackupMetaData;
	skippedCount = 0;
	appendedCount = 0;
	emittedCount = 0;
	private readonly oldTotal: number;

	constructor(allowedDbKeys: Set<string>, newer: BackupDelta_NewerMap, deleted: BackupDelta_DeletedMap, versions: { [dbKey: string]: string }, oldTotal: number) {
		super({objectMode: true});
		this.allowedDbKeys = allowedDbKeys;
		this.newer = newer;
		this.deleted = deleted;
		this.versions = versions;
		this.oldTotal = oldTotal;
		this.metadata = {collectionsData: [], timestamp: currentTimeMillis()};
	}

	getMetadata = () => this.metadata;

	assertCount = () => {
		const expected = this.oldTotal - this.skippedCount + this.appendedCount;
		if (this.emittedCount !== expected)
			throw new Error(`Delta backup count mismatch: emitted ${this.emittedCount}, expected ${expected} (old ${this.oldTotal} - skipped ${this.skippedCount} + appended ${this.appendedCount})`);
	};

	_transform(chunk: BackupCsvRow, encoding: string, callback: (error?: Error | null) => void) {
		try {
			if (!this.allowedDbKeys.has(chunk.dbKey) || this.deleted[chunk.dbKey]?.has(chunk._id)) {
				this.skippedCount++;
				return callback();
			}

			const updated = this.newer[chunk.dbKey]?.get(chunk._id);
			if (updated) {
				this.newer[chunk.dbKey]!.delete(chunk._id);
				this.emitRow(chunk.dbKey, chunk._id, JSON.stringify(updated));
				return callback();
			}

			this.emitRow(chunk.dbKey, chunk._id, chunk.document);
			callback();
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	_flush(callback: (error?: Error | null) => void) {
		try {
			for (const dbKey of Object.keys(this.newer)) {
				for (const [id, doc] of this.newer[dbKey]) {
					this.appendedCount++;
					this.emitRow(dbKey, id, JSON.stringify(doc));
				}
				this.newer[dbKey].clear();
			}
			this.assertCount();
			callback();
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	private emitRow = (dbKey: string, id: string, document: string) => {
		this.push({dbKey, _id: id, document});
		this.emittedCount++;
		const collectionData = this.metadata.collectionsData.find(data => data.dbKey === dbKey);
		if (!collectionData)
			return this.metadata.collectionsData.push({
				dbKey,
				numOfDocs: 1,
				version: this.versions[dbKey] ?? '1.0.0',
			});

		collectionData.numOfDocs++;
	};
}
