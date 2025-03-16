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

export type ApiStruct_SyncEnv = {
	vv1: {
		syncFromLastBackup: BodyApi<any, Partial<Request_FetchFromEnv> | undefined>
		syncToEnv: BodyApi<any, { env: 'dev' | 'prod', moduleName: string, items: any[] }>
		syncFromEnvBackup: BodyApi<any, Request_FetchFromEnv>
		syncFirebaseFromBackup: QueryApi<any, Request_FetchFirebaseBackup>
	}
}

export const ApiDef_SyncEnv: ApiDefResolver<ApiStruct_SyncEnv> = {
	vv1: {
		syncFromLastBackup: {method: HttpMethod.POST, path: 'v1/sync-env/sync-from-last-backup'},
		syncToEnv: {method: HttpMethod.POST, path: 'v1/sync-env/sync-to-env', timeout: 5 * Minute},
		syncFromEnvBackup: {method: HttpMethod.POST, path: 'v1/sync-env/fetch-from-env-v2', timeout: 5 * Minute},
		syncFirebaseFromBackup: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-firebase-backup', timeout: 5 * Minute}
	}
};