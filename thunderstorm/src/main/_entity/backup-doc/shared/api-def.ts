import {ApiDefResolver, HttpMethod, QueryApi} from '../../../shared/types';
import {BackupMetaData, FetchBackupDoc} from './types';
import {Minute, UniqueId} from '@nu-art/ts-common';

export type Request_BackupId = {
	backupId: string,
}

export type Response_BackupDocs = {
	backupInfo: FetchBackupDoc,
}

export type Request_GetMetadata = { backupId: UniqueId, env: string }
export type Response_FetchBackupMetadata = BackupMetaData & {
	remoteCollectionNames: string[]
}

export type ApiStruct_BackupDoc = {
	_v1: {
		getLatestBackup: QueryApi<{ latestBackupId: string }>
		initiateBackup: QueryApi<{ pathToBackup: string } | undefined>,
		fetchBackupDocs: QueryApi<Response_BackupDocs, Request_BackupId>,
		createBackup: QueryApi<{ pathToBackup: string } | undefined>,
		fetchBackupMetadata: QueryApi<Response_FetchBackupMetadata, Request_GetMetadata>,

	}
}

export const ApiDef_BackupDoc: ApiDefResolver<ApiStruct_BackupDoc> = {
	_v1: {
		getLatestBackup: {method: HttpMethod.GET, path: 'v1/sync-env/get-last-backup-id'},
		initiateBackup: {method: HttpMethod.GET, path: 'v1/initiate-backup-v2'},
		fetchBackupDocs: {method: HttpMethod.GET, path: 'v1/fetch-backup-docs-v2'},
		createBackup: {method: HttpMethod.GET, path: 'v1/sync-env/create-backup-v2', timeout: 5 * Minute},
		fetchBackupMetadata: {method: HttpMethod.GET, path: 'v1/sync-env/fetch-backup-metadata', timeout: 5 * Minute},
	}
};