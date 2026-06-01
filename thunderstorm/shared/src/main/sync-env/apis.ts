import {Minute, UniqueId} from '@nu-art/ts-common';
import {ApiDefResolver, BodyApi, HttpMethod, QueryApi} from '../types.js';
import {BackupMetaData} from '../_entity.js';


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
		createBackup: QueryApi<{ pathToBackup: string } | undefined>,
		fetchBackupMetadata: QueryApi<Response_FetchBackupMetadata, Request_GetMetadata>,
		syncFirebaseFromBackup: QueryApi<any, Request_FetchFirebaseBackup>
	}
}

export const ApiDef_SyncEnv: ApiDefResolver<ApiStruct_SyncEnv> = {
	vv1: {
		getLatestBackup: {method: HttpMethod.GET, path: 'v1/sync-env/get-last-backup-id'},
		syncToEnv: {method: HttpMethod.POST, path: 'v1/sync-env/sync-to-env', timeout: 5 * Minute},
		syncFromEnvBackup: {method: HttpMethod.POST, path: 'v1/sync-env/fetch-from-env-v2', timeout: 5 * Minute},
		createBackup: {method: HttpMethod.GET, path: 'v1/sync-env/create-backup-v2', timeout: 5 * Minute},
		fetchBackupMetadata: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-backup-metadata', timeout: 5 * Minute},
		syncFirebaseFromBackup: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-firebase-backup', timeout: 5 * Minute}
	}
};