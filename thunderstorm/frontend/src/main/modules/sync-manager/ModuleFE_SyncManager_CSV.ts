import {_keys, arrayToMap, mergeObject, Module, RuntimeModules, TypedMap} from '@nu-art/ts-common';
import {Readable, Writable} from 'stream';
import {DataStatus} from '../../core/db-api-gen/consts.js';
import {ModuleFE_BaseDB} from '../db-api-gen/ModuleFE_BaseDB.js';
import {ParseStepResult} from 'papaparse';
import {ModuleFE_CSVParser, PapaparseConfig} from '../ModuleFE_CSVParser.js';
import {ModuleSyncType} from '../db-api-gen/types.js';
import {Thunder} from '../../core/Thunder.js';
import {HeaderKey_ContentType} from '../../shared.js';


export class ModuleFE_SyncManager_CSV_Class
	extends Module {

	constructor() {
		super();
	}

	private getModulesToSync = () => RuntimeModules().filter<ModuleFE_BaseDB<any>>((module) => module.syncType === ModuleSyncType.CSVSync);

	syncFromCSVUrl = async (url: string, config?: PapaparseConfig) => {
		const modules = arrayToMap(this.getModulesToSync(), i => i.dbDef.dbKey);
		const start = performance.now();
		const dbKeys = new Set<string>();
		const itemsToSync: any[] = [];
		const errors: any[] = [];

		await new Promise<void>((resolve, reject) => {
			const isEmulator = Thunder.getInstance().getConfig().label?.toLowerCase() === 'local';
			const downloadRequestHeaders = isEmulator ? undefined : {[HeaderKey_ContentType]: 'text/csv'};
			const finalConfig = config ? mergeObject({downloadRequestHeaders}, config) : {downloadRequestHeaders};

			ModuleFE_CSVParser.fromURL(
				url,
				{
					transform: (value: string, field: string | number) => field === 'document' ? JSON.parse(value) : value,
					step: async (results: ParseStepResult<any>) => {
						if (results.errors?.length)
							return errors.push(...results.errors);

						const item = results.data;
						const module = modules[item.dbKey];
						if (!module)
							return;

						dbKeys.add(item.dbKey);
						itemsToSync.push(item);
					},

					complete: async () => {
						try {
							// Any parse error rejects the whole sync so the caller can react to
							// the failure, rather than silently committing partial data and
							// resolving as if the sync succeeded.
							if (errors.length)
								throw new Error(`CSV parsed with ${errors.length} error(s)`);
							if (dbKeys.size === 0)
								throw new Error('CSV parsed but no recognised dbKeys');

							for (const dbKey of dbKeys) {
								const items = itemsToSync.filter(item => item.dbKey === dbKey);
								const module = modules[dbKey];
								module.setDataStatus(DataStatus.UpdatingData);
								// Get all docs to upsert
								const documents = items.map(i => i.document);

								// Run upgrade processors on them from the module
								await module.upgradeInstances(documents);

								// Upsert items to the idb
								await module.IDB.syncIndexDb(documents);
								await module.cache.load();
								module.setDataStatus(DataStatus.ContainsData);
							}
							const end = performance.now();
							this.logInfo(`sync took ${((end - start) / 1000).toFixed(3)} seconds`);
							resolve();
						} catch (e) {
							this.logError('CSV sync failed', e as Error);
							reject(e);
						}
					},
					...finalConfig,
					error: (error: Error) => {
						this.logError(`CSV Parsing failed`, error);
						reject(error);
					}
				});
		});
	};

	hasAnyData = async (): Promise<boolean> => {
		for (const module of this.getModulesToSync()) {
			if (await module.IDB.count() > 0)
				return true;
		}
		return false;
	};

	readyAllModules = async () => {
		const modules = this.getModulesToSync();
		this.logDebug('Readying modules', modules);
		for (const module of modules) {
			await module.cache.load();
			module.setDataStatus(DataStatus.ContainsData);
		}
	};

	syncFromBackupStream = async (stream: Readable) => {
		const modules = this.getModulesToSync();
		this.logInfo('Modules', modules);
		const writer = new ModuleIDBWriter(modules);
		await new Promise<void>((resolve, reject) => {
			stream.pipe(writer)
				.on('error', err => reject(err))
				.on('close', () => {
					modules.forEach(module => {
						module.setDataStatus(DataStatus.ContainsData);
					});
					resolve();
				});
		});
	};

	readyAllUnreadyModules = async () => {
		const modules = this.getModulesToSync().filter(m => m.getDataStatus() === DataStatus.NoData);
		this.logDebug('Readying unready modules', modules);
		for (const module of modules) {
			await module.cache.load();
			module.setDataStatus(DataStatus.ContainsData);
		}
	};
}

export const ModuleFE_SyncManager_CSV = new ModuleFE_SyncManager_CSV_Class();

class ModuleIDBWriter
	extends Writable {

	readonly modules: ModuleFE_BaseDB<any>[];
	readonly moduleNameMap: TypedMap<ModuleFE_BaseDB<any>>;
	readonly paginationSize: number;
	private itemsToUpsert: any[] = [];

	constructor(modules: ModuleFE_BaseDB<any>[], paginationSize: number = 1000) {
		super();
		this.modules = modules;
		this.paginationSize = paginationSize;
		this.moduleNameMap = modules.reduce((acc, curr) => {
			acc[curr.dbDef.backend.name as string] = curr;
			return acc;
		}, {} as TypedMap<ModuleFE_BaseDB<any>>);
	}

	async _write(chunk: any, encoding: BufferEncoding, callback: (error?: (Error | null)) => void) {
		console.log('WRITE');
		this.itemsToUpsert.push(chunk);
		await this.upsertItems();
		callback();
	}

	async _final(callback: (error?: (Error | null)) => void) {
		await this.upsertItems(true);
		callback();
	}

	private upsertItems = async (force: boolean = false) => {
		const itemCount = this.itemsToUpsert.length;
		if ((itemCount < this.paginationSize) && !force)
			return;

		for (const item of this.itemsToUpsert) {
			const module = this.moduleNameMap[item.dbKey];
			if (!module)
				continue;

			const document = JSON.parse(item.document);
			await module.IDB.storeWrapper.upsert(document);
		}

		this.itemsToUpsert = [];
	};
}
