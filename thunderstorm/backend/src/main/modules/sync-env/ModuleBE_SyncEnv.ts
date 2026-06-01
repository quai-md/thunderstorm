import {
	ApiException,
	arrayToMap,
	BadImplementationException,
	currentTimeMillis,
	Dispatcher,
	Minute,
	Module,
	MUSTNeverHappenException,
	RuntimeModules,
	TypedMap
} from '@nu-art/ts-common';
import {ModuleBE_Firebase} from '@nu-art/firebase-backend';
import {addRoutes} from '../ModuleBE_APIs.js';
import {createBodyServerApi, createQueryServerApi} from '../../core/typed-api.js';
import {
	ApiDef,
	ApiDef_SyncEnv,
	ApiModule,
	DBModuleType,
	FetchBackupDoc,
	HeaderKey_Authorization,
	HttpMethod,
	QueryApi,
	Request_FetchFirebaseBackup,
	Request_FetchFromEnv,
	Request_GetMetadata,
	Response_BackupDocs,
	Response_FetchBackupMetadata,
	Response_SyncFromEnv,
	SyncEnv_DeletedDocRef,
	SyncEnvDeltaSummary
} from '@nu-art/thunderstorm-shared';
import {AxiosHttpModule} from '../http/AxiosHttpModule.js';
import {MemKey_HttpRequest} from '../server/consts.js';
import {ModuleBE_BaseApi_Class} from '../db-api-gen/ModuleBE_BaseApi.js';
import {Storm} from '../../core/Storm.js';
import {ModuleBE_BackupDocDB} from '../../_entity/backup-doc/index.js';
import {ModuleBE_BaseDB} from '../db-api-gen/ModuleBE_BaseDB.js';
import {SyncEnvDeltaSummaryBuilder} from './sync-env-delta.js';
import {Readable, Transform, Writable} from 'stream';
import {firestore} from 'firebase-admin';
import {HttpCodes} from '@nu-art/ts-common/core/exceptions/http-codes';


type Config = {
	urlMap: TypedMap<string>
	sessionMap: TypedMap<TypedMap<string>>,
	maxBatch: number
	shouldBackupBeforeSync?: boolean;
	allowCleanSync?: boolean;
	allowSyncEnv?: boolean;
	allowedEnvsToSyncFrom?: string[]
}

/**
 * Per source-env sync watermark. `backupTimestamp` is the source backup's own timestamp that was last
 * applied locally — the next delta only upserts docs whose `__updated` exceeds it. `syncTimestamp` is
 * when that apply ran locally (diagnostics only).
 */
type EnvSyncIndicator = { backupTimestamp: number, syncTimestamp: number };

export interface OnSyncEnvCompleted {
	__onSyncEnvCompleted: (env: string, baseUrl: string, requiredHeaders: TypedMap<string>) => void;
}

const dispatch_OnSyncEnvCompleted = new Dispatcher<OnSyncEnvCompleted, '__onSyncEnvCompleted'>(
	'__onSyncEnvCompleted');

class ModuleBE_SyncEnv_Class
	extends Module<Config> {

	constructor() {
		super();
		this.setDefaultConfig({maxBatch: 500});
	}

	init() {
		super.init();
		addRoutes([
			createBodyServerApi(ApiDef_SyncEnv.vv1.syncToEnv, this.pushToEnv),
			createBodyServerApi(ApiDef_SyncEnv.vv1.syncFromEnvBackup, this.syncFromEnvBackup),
			createQueryServerApi(ApiDef_SyncEnv.vv1.getLatestBackup, this.getLatestBackupId),
			createQueryServerApi(ApiDef_SyncEnv.vv1.createBackup, this.createBackup),
			createQueryServerApi(ApiDef_SyncEnv.vv1.fetchBackupMetadata, this.fetchBackupMetadata),
			createQueryServerApi(ApiDef_SyncEnv.vv1.syncFirebaseFromBackup, this.syncFirebaseFromBackup),
		]);
	}

	fetchBackupMetadata = async (queryParams: Request_GetMetadata): Promise<Response_FetchBackupMetadata> => {
		const backupInfo = await this.getBackupInfo(queryParams);

		if (!backupInfo)
			throw new ApiException(404, 'backup file not found');

		if (!backupInfo.metadata)
			throw new ApiException(404, 'No metadata found on this backup');

		return {
			...backupInfo.metadata,
			remoteCollectionNames: (RuntimeModules()
				.filter<ModuleBE_BaseDB<any>>((module: DBModuleType) => !!module.dbDef?.dbKey)).map(_module => _module.dbDef.dbKey)
		};
	};

	async pushToEnv(body: {
		env: 'dev' | 'prod',
		moduleName: string,
		items: any[]
	}) {
		const remoteUrls = {
			dev: 'https://us-central1-shopify-manager-tool-dev.cloudfunctions.net/api',
			prod: 'https://mng.be.petitfawn.com'
		};

		const url = remoteUrls[body.env];
		const sessionId = MemKey_HttpRequest.get().headers[HeaderKey_Authorization];

		const module = RuntimeModules().find<ModuleBE_BaseApi_Class<any>>((module: ApiModule) => module.dbModule?.dbDef?.dbKey === body.moduleName);

		const upsertAll = module.apiDef.v1.upsertAll;
		const response: Response_BackupDocs = await AxiosHttpModule
			.createRequest({...upsertAll, fullUrl: url + '/' + upsertAll.path, timeout: 5 * Minute})
			.setBody(body.items)
			.setUrlParams(body.items)
			.addHeader(HeaderKey_Authorization, sessionId!)
			.executeSync(true);

		console.log(response);
	}

	createBackup = async () => {
		return ModuleBE_BackupDocDB.initiateBackup(true);
	};

	getLatestBackupId = async () => {
		const backups = await ModuleBE_BackupDocDB.collection.query.custom({orderBy: [{key: "__created", order: "desc"}], limit: 1});
		const latestBackup = backups[0];
		if (!latestBackup)
			throw HttpCodes._4XX.ENTITY_DOESNT_EXISTS("No backup found");

		const latestBackupId = latestBackup?._id;
		return {latestBackupId: latestBackupId};
	};

	syncFromEnvBackup = async (body: Request_FetchFromEnv): Promise<Response_SyncFromEnv> => {
		if (!this.config.allowSyncEnv)
			throw new MUSTNeverHappenException(`SyncEnv is disabled on this env- to sync into this env, add 'allowSyncEnv: true'.`);

		//CleanSync means deleting collections before syncing them
		if (!this.config.allowCleanSync && body.cleanSync)
			throw new MUSTNeverHappenException(`CleanSync is disabled on this env- to CleanSync into this env, add 'allowCleanSync: true'.`);

		if (Storm.getInstance().getEnvironment().toLowerCase() === 'prod' && body.env.toLowerCase() !== 'prod')
			throw new MUSTNeverHappenException('MUST NEVER SYNC ENV THAT IS NOT PROD TO PROD!!');

		if (this.config.allowedEnvsToSyncFrom && !this.config.allowedEnvsToSyncFrom.includes(body.env))
			throw new MUSTNeverHappenException(`Env ${Storm.getInstance().getEnvironment()
				.toLowerCase()} doesn't have env ${body.env} in it's allowedEnvsToSyncFrom list.`);

		this.logInfoBold('Received API call Fetch From Env!');
		this.logInfo(`Origin env: ${body.env}, backupId: ${body.backupId}`);
		let startTime = undefined; // required for log
		let endTime = undefined; // required for log

		if (this.config.shouldBackupBeforeSync) {
			this.logInfo(`----  Creating Backup... ----`);
			startTime = performance.now(); // required for log
			await this.createBackup();
			endTime = performance.now(); // required for log
			this.logInfo(`Backup took ${((endTime - startTime) / 1000).toFixed(3)} seconds`);
		}

		if (body.cleanSync) {
			this.logInfo(`----  Cleaning Collections From DB... ----`);
			//Delete all modules specified for syncing
			const modulesToDelete = RuntimeModules().filter((module: DBModuleType) => body.selectedModules.includes(module.dbDef?.dbKey));
			for (const module of modulesToDelete) {
				await (module as ModuleBE_BaseDB<any>).collection.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
				this.logInfo(`----  Cleaned Collection ${module.dbDef!.dbKey} ----`);
			}
		}

		//Prepare Syncing data
		const backupInfo = await this.getBackupInfo(body);
		const stream = await ModuleBE_BackupDocDB.createBackupReadStream(backupInfo);

		this.logInfo(`----  Syncing Collections From Backup... ----`);
		startTime = performance.now();
		let response: Response_SyncFromEnv = {};
		if (body.delta) {
			response = {summary: await this.applyDeltaFromBackup(body, backupInfo, stream)};
		} else {
			const collectionFilter = new SyncCollectionFilter(body.selectedModules);
			const collectionWriter = new CollectionBatchWriter(body.chunkSize);
			await new Promise<void>((resolve, reject) => {
				stream
					.pipe(collectionFilter)
					.pipe(collectionWriter)
					.on('finish', () => resolve())
					.on('error', reject);
			});
		}
		endTime = performance.now();
		this.logInfo(`Syncing Collections took ${((endTime - startTime) / 1000).toFixed(3)} seconds`);

		this.logInfo(`----  Syncing Other Modules... ----`);
		await dispatch_OnSyncEnvCompleted.dispatchModuleAsync(body.env, this.config.urlMap[body.env], this.config.sessionMap[body.env]!);
		this.logInfo(`---- DONE Syncing Other Modules----`);

		if (this.config.shouldBackupBeforeSync && endTime !== undefined && startTime !== undefined)
			this.logInfo(`(Backup took ${((endTime - startTime) / 1000).toFixed(3)} seconds)`);

		return response;
	};

	/**
	 * Orchestrates a watermark-based delta apply for the legacy backupId path:
	 * reads the stored per-env watermark, applies only docs newer than it, then advances the indicator.
	 * The backupId path carries no tombstones, so this is upsert-only (deletes flow through the artifact path).
	 */
	private applyDeltaFromBackup = async (body: Request_FetchFromEnv, backupInfo: FetchBackupDoc, stream: Readable): Promise<SyncEnvDeltaSummary> => {
		// A wiped collection (cleanSync) or an explicit forceFull must re-import everything from scratch.
		const resetWatermark = !!body.cleanSync || !!body.forceFull;
		const indicator = resetWatermark ? undefined : await this.getEnvSyncIndicator(body.env);
		const watermark = indicator?.backupTimestamp ?? 0;
		const backupTimestamp = backupInfo.metadata?.timestamp ?? currentTimeMillis();

		this.logInfo(`Delta apply from env '${body.env}' — watermark: ${watermark}, backup ts: ${backupTimestamp}`);
		const summary = await this.applyBackupStreamDelta(stream, {
			selectedModules: body.selectedModules,
			watermark,
			chunkSize: body.chunkSize,
			deleteMissing: body.deleteMissing,
		});

		await this.setEnvSyncIndicator(body.env, {backupTimestamp, syncTimestamp: currentTimeMillis()});
		return summary;
	};

	/**
	 * Reusable change-tracked apply engine. Streams a backup, upserts only docs whose `__updated`
	 * exceeds the watermark, and (when `deleteMissing` + `deletedDocs` are provided) removes
	 * source-deleted docs locally. Returns a per-dbKey accounting. The caller owns watermark
	 * computation and indicator persistence so a partial failure never advances the watermark.
	 */
	applyBackupStreamDelta = async (stream: Readable, options: {
		selectedModules: string[],
		watermark: number,
		chunkSize: number,
		deleteMissing?: boolean,
		deletedDocs?: SyncEnv_DeletedDocRef[],
	}): Promise<SyncEnvDeltaSummary> => {
		const summaryBuilder = new SyncEnvDeltaSummaryBuilder(options.watermark);
		const writer = new CollectionDeltaWriter(options.chunkSize, summaryBuilder, options.selectedModules);
		await new Promise<void>((resolve, reject) => {
			stream
				.pipe(writer)
				.on('finish', () => resolve())
				.on('error', reject);
		});

		if (options.deleteMissing && options.deletedDocs?.length)
			await this.applyDeletes(options.deletedDocs, options.selectedModules, options.chunkSize, summaryBuilder);

		return summaryBuilder.summary;
	};

	/** Batch-deletes source tombstones locally, scoped to the selected modules, recording each in the summary. */
	private applyDeletes = async (deletedDocs: SyncEnv_DeletedDocRef[], selectedModules: string[], chunkSize: number, summaryBuilder: SyncEnvDeltaSummaryBuilder) => {
		const allowed = new Set(selectedModules);
		const firestore = ModuleBE_Firebase.createAdminSession().getFirestoreV3().firestore;
		const modules = arrayToMap(RuntimeModules()
			.filter((module: DBModuleType) => !(!module || !module.dbDef)), module => module.dbDef!.dbKey);

		let batch = firestore.batch();
		let pending = 0;
		for (const ref of deletedDocs) {
			if (!allowed.has(ref.__collectionName))
				continue;

			const module = modules[ref.__collectionName];
			if (!module) {
				this.logWarning(`Could not get module for deleted doc with dbKey ${ref.__collectionName}`);
				continue;
			}

			batch.delete(firestore.doc(`${module.dbDef!.backend.name}/${ref.__docId}`));
			summaryBuilder.recordDelete(ref.__collectionName);
			if (++pending === chunkSize) {
				await batch.commit();
				batch = firestore.batch();
				pending = 0;
			}
		}

		if (pending > 0)
			await batch.commit();
	};

	private indicatorRef = (env: string) =>
		ModuleBE_Firebase.createAdminSession().getDatabase().ref<EnvSyncIndicator>(`/state/${this.getName()}/lastSync/${env}`);

	/** The last applied {backupTimestamp, syncTimestamp} for a source env — the watermark for the next delta. */
	getEnvSyncIndicator = async (env: string): Promise<EnvSyncIndicator | undefined> => {
		return this.indicatorRef(env).get();
	};

	setEnvSyncIndicator = async (env: string, indicator: EnvSyncIndicator): Promise<void> => {
		await this.indicatorRef(env).set(indicator);
	};

	private async getBackupInfo(queryParams: Request_GetMetadata) {
		const {backupId, env} = queryParams;
		if (!env)
			throw new BadImplementationException(`Did not receive env in the fetch from env api call!`);

		return ModuleBE_BackupDocDB.getBackupInfo(backupId, this.config.urlMap[env], this.config.sessionMap[env]);
	}

	syncFirebaseFromBackup = async (queryParams: Request_FetchFirebaseBackup) => {
		try {
			this.logDebug('Getting the firebase backup file');
			const firebaseSessionAdmin = ModuleBE_Firebase.createAdminSession();
			const backupInfo = await this.getBackupInfo(queryParams);
			const database = firebaseSessionAdmin.getDatabase();

			this.logDebug('Reading the file from storage');
			const signedUrlDef: ApiDef<QueryApi<any>> = {
				method: HttpMethod.GET,
				path: '',
				fullUrl: backupInfo.firebaseSignedUrl
			};
			const firebaseFile = await AxiosHttpModule
				.createRequest(signedUrlDef)
				.executeSync();

			this.logDebug('Setting the file in firebase database');
			await database.set('/', firebaseFile);
		} catch (err: any) {
			throw new ApiException(500, err);
		}
	};
}

export const ModuleBE_SyncEnv = new ModuleBE_SyncEnv_Class();

class SyncCollectionFilter
	extends Transform {

	readonly allowedDbKeys: string[];

	constructor(allowedDbKeys: string[]) {
		super({objectMode: true});
		this.allowedDbKeys = allowedDbKeys;
	}

	_transform(chunk: any, encoding: string, callback: Function) {
		if (this.allowedDbKeys.includes(chunk.dbKey)) {
			this.push(chunk);
		}
		callback();
	}
}

class CollectionBatchWriter
	extends Writable {

	private itemCount: number = 0;
	private paginationSize: number;
	private firestore: firestore.Firestore;
	private batchWriter: firestore.WriteBatch;
	private modules;

	constructor(paginationSize: number) {
		super({objectMode: true});
		this.paginationSize = paginationSize;
		const firebaseSessionAdmin = ModuleBE_Firebase.createAdminSession();
		this.firestore = firebaseSessionAdmin.getFirestoreV3().firestore;
		this.batchWriter = this.firestore.batch();
		this.modules = arrayToMap(RuntimeModules()
			.filter((module: DBModuleType) => !(!module || !module.dbDef)), module => module.dbDef!.dbKey);
	}

	async _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
		try {
			const module = this.modules[chunk.dbKey];
			if (!module) {
				ModuleBE_SyncEnv.logWarning(`Could not get module for chunk with dbKey ${chunk.dbKey}`);
				callback();
			}

			const collectionName = module.dbDef!.backend.name;
			const docRef = this.firestore.doc(`${collectionName}/${chunk._id}`);
			const data = JSON.parse(chunk.document);
			this.batchWriter.set(docRef, data);
			this.itemCount++;

			if (this.itemCount === this.paginationSize) {
				const prevBatchWriter = this.batchWriter;
				this.batchWriter = this.firestore.batch();
				this.itemCount = 0;
				await prevBatchWriter.commit();
			}
			callback();
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	async _final(callback: (error?: Error | null) => void) {
		try {
			await this.batchWriter.commit();
			callback();
		} catch (err: any) {
			callback(err as Error);
		}
	}
}

/**
 * Change-tracked variant of {@link CollectionBatchWriter}: filters by selected modules and a watermark in a
 * single pass, upserting only docs whose `__updated` is strictly newer than the watermark and recording a
 * per-dbKey {upserted, skipped} tally. Skipped docs are never read or written, which is what keeps the
 * delta sync cheap on repeat runs.
 */
class CollectionDeltaWriter
	extends Writable {

	private itemCount: number = 0;
	private readonly paginationSize: number;
	private readonly summaryBuilder: SyncEnvDeltaSummaryBuilder;
	private readonly allowedDbKeys: Set<string>;
	private firestore: firestore.Firestore;
	private batchWriter: firestore.WriteBatch;
	private modules;

	constructor(paginationSize: number, summaryBuilder: SyncEnvDeltaSummaryBuilder, selectedModules: string[]) {
		super({objectMode: true});
		this.paginationSize = paginationSize;
		this.summaryBuilder = summaryBuilder;
		this.allowedDbKeys = new Set(selectedModules);
		const firebaseSessionAdmin = ModuleBE_Firebase.createAdminSession();
		this.firestore = firebaseSessionAdmin.getFirestoreV3().firestore;
		this.batchWriter = this.firestore.batch();
		this.modules = arrayToMap(RuntimeModules()
			.filter((module: DBModuleType) => !(!module || !module.dbDef)), module => module.dbDef!.dbKey);
	}

	async _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
		try {
			if (!this.allowedDbKeys.has(chunk.dbKey))
				return callback();

			const module = this.modules[chunk.dbKey];
			if (!module) {
				ModuleBE_SyncEnv.logWarning(`Could not get module for chunk with dbKey ${chunk.dbKey}`);
				return callback();
			}

			const data = JSON.parse(chunk.document);
			if (!this.summaryBuilder.considerUpsert(chunk.dbKey, data.__updated))
				return callback();

			const docRef = this.firestore.doc(`${module.dbDef!.backend.name}/${chunk._id}`);
			this.batchWriter.set(docRef, data);
			this.itemCount++;

			if (this.itemCount === this.paginationSize) {
				const prevBatchWriter = this.batchWriter;
				this.batchWriter = this.firestore.batch();
				this.itemCount = 0;
				await prevBatchWriter.commit();
			}
			callback();
		} catch (error) {
			callback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	async _final(callback: (error?: Error | null) => void) {
		try {
			await this.batchWriter.commit();
			callback();
		} catch (err: any) {
			callback(err as Error);
		}
	}
}
