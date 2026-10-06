import {Module} from '@nu-art/ts-common';
import {
	ApiDef_SyncEnv,
	ApiDefCaller,
	ApiStruct_SyncEnv,
	Const_SyncEnv_ChunkSize,
	Const_SyncEnv_SourceProd,
	Request_SyncLatestFromEnv,
	Response_SyncFromEnv
} from '../../shared.js';
import {apiWithBody, apiWithQuery} from '../../core/typed-api.js';
import {Thunder} from '../../core/Thunder.js';
import {genericNotificationAction} from '../../components/TS_Notifications/genericNotificationAction.js';
import {ModuleFE_Toaster} from '../../component-modules/ModuleFE_Toaster.js';
import {ModuleFE_SyncManager} from '../sync-manager/ModuleFE_SyncManager.js';


export type Request_SyncFromProd = Omit<Request_SyncLatestFromEnv, 'env' | 'chunkSize'> & { chunkSize?: number };

class ModuleFE_SyncEnvV2_Class
	extends Module {

	readonly vv1: ApiDefCaller<ApiStruct_SyncEnv>['vv1'];

	constructor() {
		super();
		this.vv1 = {
			getLatestBackup: apiWithQuery(ApiDef_SyncEnv.vv1.getLatestBackup),
			syncToEnv: apiWithBody(ApiDef_SyncEnv.vv1.syncToEnv),
			syncFromEnvBackup: apiWithBody(ApiDef_SyncEnv.vv1.syncFromEnvBackup),
			getLatestBackupDelta: apiWithBody(ApiDef_SyncEnv.vv1.getLatestBackupDelta),
			syncLatestFromEnv: apiWithBody(ApiDef_SyncEnv.vv1.syncLatestFromEnv),
			getSyncableCollections: apiWithQuery(ApiDef_SyncEnv.vv1.getSyncableCollections),
			createBackup: apiWithQuery(ApiDef_SyncEnv.vv1.createBackup),
			fetchBackupMetadata: apiWithQuery(ApiDef_SyncEnv.vv1.fetchBackupMetadata),
			syncFirebaseFromBackup: apiWithQuery(ApiDef_SyncEnv.vv1.syncFirebaseFromBackup)
		};
	}

	isProd = () => Thunder.getInstance().getEnvironment()?.toLowerCase() === Const_SyncEnv_SourceProd;

	fetchSyncableCollections = async (): Promise<string[]> => {
		const {collections} = await this.vv1.getSyncableCollections({}).executeSync();
		return collections;
	};

	syncFromProd = async (request: Request_SyncFromProd): Promise<Response_SyncFromEnv> => {
		ModuleFE_SyncManager.stopListening();
		try {
			return await this.vv1.syncLatestFromEnv({
				env: Const_SyncEnv_SourceProd,
				chunkSize: request.chunkSize ?? Const_SyncEnv_ChunkSize,
				selectedModules: request.selectedModules,
				deleteMissing: request.deleteMissing,
				forceFull: request.forceFull,
				cleanSync: request.cleanSync,
			}).executeSync();
		} finally {
			ModuleFE_SyncManager.startListening();
		}
	};

	runOneClickFromProd = async () => {
		await genericNotificationAction(async () => {
			try {
				const collections = await this.fetchSyncableCollections();
				await this.syncFromProd({
					selectedModules: collections,
					deleteMissing: true,
				});
				ModuleFE_Toaster.toastSuccess('Synced DB from Prod');
			} catch (e: any) {
				ModuleFE_Toaster.toastError(e?.message || 'Sync DB from Prod failed');
				throw e;
			}
		}, 'Syncing DB from Prod');
	};
}

export const ModuleFE_SyncEnvV2 = new ModuleFE_SyncEnvV2_Class();
