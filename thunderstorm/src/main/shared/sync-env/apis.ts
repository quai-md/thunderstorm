import {Minute, UniqueId} from '@nu-art/ts-common';
import {ApiDefResolver, BodyApi, HttpMethod, QueryApi} from '../types';
import {BackupMetaData} from '../../_entity/backup-doc/shared';


export type Request_FetchFromEnv = {
	backupId: string,
	env: string,
	chunkSize: number,
	selectedModules: string[]
	cleanSync?: boolean
}

export type Request_FetchFirebaseBackup = { backupId: UniqueId, env: string }

export type Request_GetMetadata = { backupId: UniqueId, env: string }
export type Response_FetchBackupMetadata = BackupMetaData & {
	remoteCollectionNames: string[]
}
export type ApiStruct_SyncEnv = {
	vv1: {
		syncToEnv: BodyApi<any, { env: 'dev' | 'prod', moduleName: string, items: any[] }>
		syncFromEnvBackup: BodyApi<any, Request_FetchFromEnv>
		createBackup: QueryApi<{ pathToBackup: string } | undefined>,
		fetchBackupMetadata: QueryApi<Response_FetchBackupMetadata, Request_GetMetadata>,
		syncFirebaseFromBackup: QueryApi<any, Request_FetchFirebaseBackup>
	}
}

export const ApiDef_SyncEnv: ApiDefResolver<ApiStruct_SyncEnv> = {
	vv1: {
		syncToEnv: {method: HttpMethod.POST, path: 'v1/sync-env/sync-to-env', timeout: 5 * Minute},
		syncFromEnvBackup: {method: HttpMethod.POST, path: 'v1/sync-env/fetch-from-env-v2', timeout: 5 * Minute},
		createBackup: {method: HttpMethod.GET, path: 'v1/sync-env/create-backup-v2', timeout: 5 * Minute},
		fetchBackupMetadata: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-backup-metadata', timeout: 5 * Minute},
		syncFirebaseFromBackup: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-firebase-backup', timeout: 5 * Minute}
	}
};