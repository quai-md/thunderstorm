import {Minute, UniqueId} from '@nu-art/ts-common';
import {ApiDefResolver, BodyApi, HttpMethod, QueryApi} from '../types.js';
import {BackupMetaData, FetchBackupDoc} from '../_entity.js';


export type Request_FetchFromEnv = {
	backupId: string,
	env: string,
	chunkSize: number,
	selectedModules: string[]
	cleanSync?: boolean
	/** Opt into the change-tracked (watermark) apply instead of the legacy brute-force overwrite. */
	delta?: boolean
	/** When delta + the caller provides tombstones, delete locally the docs removed at the source. */
	deleteMissing?: boolean
	/** Ignore the stored per-env watermark and re-apply the full backup (rebuilds the indicator). */
	forceFull?: boolean
}

/** A source-side tombstone reference: the collection (dbKey) and the deleted document id. */
export type SyncEnv_DeletedDocRef = { __collectionName: string, __docId: UniqueId };

/** Per-dbKey accounting of a delta apply. */
export type SyncEnvDeltaSummary = { [dbKey: string]: { upserted: number, deleted: number, skipped: number } };

export type Response_SyncFromEnv = { summary?: SyncEnvDeltaSummary };

/**
 * Source-side (e.g. prod) feed for the fast delta sync. Returns the latest backup descriptor (to stream)
 * and the tombstones deleted at the source since the caller's last applied watermark.
 */
export type Request_GetLatestBackupDelta = {
	sinceTimestamp?: number // omit / 0 → skip the deleted-docs scan (initial / full import)
	selectedModules: string[]
}
export type Response_GetLatestBackupDelta = {
	backupInfo: FetchBackupDoc
	deletedDocs: SyncEnv_DeletedDocRef[]
}

export const Const_SyncEnv_SourceProd = 'prod';
export const Const_SyncEnv_ChunkSize = 500;

export type Request_CreateBackup = {
	/** When true (SyncEnv default), rewrite the last snapshot with docs changed since its timestamp. */
	delta?: boolean
}

export const resolveDeltaQueryFlag = (value: boolean | string | undefined, defaultValue: boolean): boolean => {
	if (value === undefined)
		return defaultValue;

	if (value === true || value === 'true')
		return true;

	if (value === false || value === 'false')
		return false;

	return defaultValue;
};

/** Local-only trigger: change-tracked sync from the source env's latest backup, applying source deletions. */
export type Request_SyncLatestFromEnv = {
	env: string
	chunkSize: number
	selectedModules: string[]
	deleteMissing?: boolean
	forceFull?: boolean
	/** Wipe the selected collections before applying (modal per-collection full sync). */
	cleanSync?: boolean
}

export type Response_GetSyncableCollections = {
	collections: string[]
}

export type Request_FetchFirebaseBackup = { backupId: UniqueId, env: string }

export type Request_GetMetadata = { backupId: UniqueId, env: string }
export type Response_FetchBackupMetadata = BackupMetaData & {
	remoteCollectionNames: string[]
}
export type ApiStruct_SyncEnv = {
	vv1: {
		getLatestBackup: QueryApi<{ latestBackupId: string }>
		syncToEnv: BodyApi<any, { env: 'dev' | 'prod', moduleName: string, items: any[] }>
		syncFromEnvBackup: BodyApi<Response_SyncFromEnv, Request_FetchFromEnv>
		getLatestBackupDelta: BodyApi<Response_GetLatestBackupDelta, Request_GetLatestBackupDelta>
		syncLatestFromEnv: BodyApi<Response_SyncFromEnv, Request_SyncLatestFromEnv>
		getSyncableCollections: QueryApi<Response_GetSyncableCollections>
		createBackup: QueryApi<{ pathToBackup: string } | undefined, Request_CreateBackup>
		fetchBackupMetadata: QueryApi<Response_FetchBackupMetadata, Request_GetMetadata>,
		syncFirebaseFromBackup: QueryApi<any, Request_FetchFirebaseBackup>
	}
}

export const ApiDef_SyncEnv: ApiDefResolver<ApiStruct_SyncEnv> = {
	vv1: {
		getLatestBackup: {method: HttpMethod.GET, path: 'v1/sync-env/get-last-backup-id'},
		syncToEnv: {method: HttpMethod.POST, path: 'v1/sync-env/sync-to-env', timeout: 5 * Minute},
		syncFromEnvBackup: {method: HttpMethod.POST, path: 'v1/sync-env/fetch-from-env-v2', timeout: 5 * Minute},
		getLatestBackupDelta: {method: HttpMethod.POST, path: 'v1/sync-env/get-latest-backup-delta', timeout: 5 * Minute},
		syncLatestFromEnv: {method: HttpMethod.POST, path: 'v1/sync-env/sync-latest-from-env', timeout: 5 * Minute},
		getSyncableCollections: {method: HttpMethod.GET, path: 'v1/sync-env/get-syncable-collections'},
		createBackup: {method: HttpMethod.GET, path: 'v1/sync-env/create-backup-v2', timeout: 5 * Minute},
		fetchBackupMetadata: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-backup-metadata', timeout: 5 * Minute},
		syncFirebaseFromBackup: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-firebase-backup', timeout: 5 * Minute}
	}
};