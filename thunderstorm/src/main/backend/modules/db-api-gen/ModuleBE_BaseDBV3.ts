/*
 * Database API Generator is a utility library for Thunderstorm.
 *
 * Given proper configurations it will dynamically generate APIs to your Firestore
 * collections, will assert uniqueness and restrict deletion... and more
 *
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {_EmptyQuery, EntityDependencyError, FirestoreQuery,} from '@nu-art/firebase';
import {_keys, ApiException, asArray, currentTimeMillis, DB_Object, DBDef_V3, DBProto, filterDuplicates, filterInstances, Module} from '@nu-art/ts-common';
import {ModuleBE_Firebase,} from '@nu-art/firebase/backend';
import {FirestoreCollectionV3, PostWriteProcessingData} from '@nu-art/firebase/backend/firestore-v3/FirestoreCollectionV3';
import {firestore} from 'firebase-admin';
import {canDeleteDispatcherV2} from '@nu-art/firebase/backend/firestore-v2/consts';
import {DBApiBEConfigV3, getModuleBEConfigV3} from '../../core/v3-db-def';
import {OnFirestoreBackupSchedulerActV2} from '../backup/ModuleBE_v2_BackupScheduler';
import {FirestoreBackupDetailsV2} from '../backup/ModuleBE_v2_Backup';
import {Response_DBSync} from '../../../shared';
import {ModuleBE_v2_SyncManager} from '../sync-manager/ModuleBE_v2_SyncManager';
import {DocWrapperV3} from '@nu-art/firebase/backend/firestore-v3/DocWrapperV3';
import Transaction = firestore.Transaction;


export type BaseDBApiConfigV3 = {
	projectId?: string,
	chunksSize: number
}

export type DBApiConfigV3<Proto extends DBProto<any>> = BaseDBApiConfigV3 & DBApiBEConfigV3<Proto>
const CONST_DefaultWriteChunkSize = 200;

/**
 * An abstract base class used for implementing CRUD operations on a specific collection.
 *
 * By default, it exposes API endpoints for creating, deleting, updating, querying and querying for unique document.
 */
export abstract class ModuleBE_BaseDBV3<Proto extends DBProto<any>, ConfigType extends {} = {}>
	extends Module<ConfigType & DBApiConfigV3<Proto>>
	implements OnFirestoreBackupSchedulerActV2 {

	// @ts-ignore
	private readonly ModuleBE_BaseDBV2 = true;

	// private static DeleteHardLimit = 250;
	public collection!: FirestoreCollectionV3<Proto>;
	public dbDef: DBDef_V3<Proto>;
	public query!: FirestoreCollectionV3<Proto>['query'];
	public create!: FirestoreCollectionV3<Proto>['create'];
	public set!: FirestoreCollectionV3<Proto>['set'];
	public delete!: FirestoreCollectionV3<Proto>['delete'];
	public doc!: FirestoreCollectionV3<Proto>['doc'];
	public runTransaction!: FirestoreCollectionV3<Proto>['runTransaction'];

	protected constructor(dbDef: DBDef_V3<Proto>, appConfig?: BaseDBApiConfigV3) {
		super();

		const config = getModuleBEConfigV3(dbDef);

		const preConfig = {chunksSize: CONST_DefaultWriteChunkSize, ...config, ...appConfig};
		// @ts-ignore
		this.setDefaultConfig(preConfig);
		this.dbDef = dbDef;
		this.canDeleteItems.bind(this);
		this._preWriteProcessing.bind(this);
		this._postWriteProcessing.bind(this);
		this.upgradeInstances.bind(this);
		this.manipulateQuery.bind(this);
		this.collectDependencies.bind(this);
	}

	/**
	 * Executed during the initialization of the module.
	 * The collection reference is set in this method.
	 */
	init() {
		const firestore = ModuleBE_Firebase.createAdminSession(this.config?.projectId).getFirestoreV3();
		this.collection = firestore.getCollection<Proto['dbType']>(this.dbDef, {
			canDeleteItems: this.canDeleteItems.bind(this),
			preWriteProcessing: this._preWriteProcessing.bind(this),
			postWriteProcessing: this._postWriteProcessing.bind(this),
			upgradeInstances: this.upgradeInstances.bind(this),
			manipulateQuery: this.manipulateQuery.bind(this)
		});

		// ############################## API ##############################
		this.runTransaction = this.collection.runTransaction;
		type Callable = {
			[K: string]: ((p: any) => Promise<any> | any) | Callable
		}

		const wrapInTryCatch = <T extends Callable>(input: T, path?: string): T => _keys(input).reduce((acc: any, key: keyof T) => {
			const value = input[key];
			const newPath = path ? `${path}.${String(key)}` : String(key);

			if (typeof value === 'function') {
				acc[key] = (async (...args: any[]) => {
					try {
						return await (value as Function)(...args);
					} catch (e: any) {
						this.logError(`Error while calling "${newPath}"`);
						throw e;
					}
				});
				return acc;
			}

			if (typeof value === 'object' && value !== null) {
				acc[key] = wrapInTryCatch(value, newPath);
				return acc;
			}

			acc[key] = value;

			return acc;
		}, {} as T);

		this.query = wrapInTryCatch(this.collection.query, 'query');
		this.create = wrapInTryCatch(this.collection.create, 'create');
		this.set = wrapInTryCatch(this.collection.set, 'set');
		this.delete = wrapInTryCatch(this.collection.delete, 'delete');
		this.doc = wrapInTryCatch(this.collection.doc, 'doc');
	}

	getCollectionName() {
		return this.config.collectionName;
	}

	getItemName() {
		return this.config.itemName;
	}

	__onFirestoreBackupSchedulerActV2(): FirestoreBackupDetailsV2<Proto['dbType']>[] {
		return [{
			query: this.resolveBackupQuery(),
			queryFunction: this.collection.query.custom,
			moduleKey: this.config.collectionName,
			version: this.config.versions[0]
		}];
	}

	protected resolveBackupQuery(): FirestoreQuery<Proto['dbType']> {
		return _EmptyQuery;
	}

	querySync = async (syncQuery: FirestoreQuery<Proto['dbType']>): Promise<Response_DBSync<Proto['dbType']>> => {
		const items = await this.collection.query.custom(syncQuery);
		const deletedItems = await ModuleBE_v2_SyncManager.queryDeleted(this.config.collectionName, syncQuery as FirestoreQuery<DB_Object>);

		await this.upgradeInstances(items);
		return {toUpdate: items, toDelete: deletedItems};
	};

	private _preWriteProcessing = async (dbItem: Proto['uiType'], transaction?: Transaction, upgrade = true) => {
		await this.preWriteProcessing(dbItem, transaction);
	};

	/**
	 * Override this method to customize the processing that should be done before create, set or update.
	 *
	 * @param transaction - The transaction object.
	 * @param dbInstance - The DB entry for which the uniqueness is being asserted.
	 */
	protected async preWriteProcessing(dbInstance: Proto['uiType'], transaction?: Transaction) {
	}

	private _postWriteProcessing = async (data: PostWriteProcessingData<Proto['dbType']>) => {
		const now = currentTimeMillis();

		if (data.updated && !(Array.isArray(data.updated) && data.updated.length === 0)) {
			const latestUpdated = Array.isArray(data.updated) ?
				data.updated.reduce((toRet, current) => Math.max(toRet, current.__updated), data.updated[0].__updated) :
				data.updated.__updated;
			await ModuleBE_v2_SyncManager.setLastUpdated(this.config.collectionName, latestUpdated);
		}

		if (data.deleted && !(Array.isArray(data.updated) && data.updated.length === 0)) {
			await ModuleBE_v2_SyncManager.onItemsDeleted(this.config.collectionName, asArray(data.deleted), this.config.uniqueKeys);
			await ModuleBE_v2_SyncManager.setLastUpdated(this.config.collectionName, now);
		} else if (data.deleted === null)
			// this means the whole collection has been deleted - setting the oldestDeleted to now will trigger a clean sync
			await ModuleBE_v2_SyncManager.setOldestDeleted(this.config.collectionName, now);

		await this.postWriteProcessing(data);
	};

	/**
	 * Override this method to customize processing that should be done after create, set, update or delete.
	 * @param data
	 */
	protected async postWriteProcessing(data: PostWriteProcessingData<Proto>) {
	}

	manipulateQuery(query: FirestoreQuery<Proto['dbType']>): FirestoreQuery<Proto['dbType']> {
		return query;
	}

	preUpsertProcessing!: never;

	/**
	 * Override this method to provide actions or assertions to be executed before the deletion happens.
	 * @param transaction - The transaction object
	 * @param dbItems - The DB entry that is going to be deleted.
	 */
	async canDeleteItems(dbItems: Proto['dbType'][], transaction?: Transaction) {
		const dependencies = await this.collectDependencies(dbItems, transaction);
		if (dependencies)
			throw new ApiException<EntityDependencyError>(422, 'entity has dependencies').setErrorBody({
				type: 'has-dependencies',
				data: dependencies
			});
	}

	async collectDependencies(dbInstances: Proto['dbType'][], transaction?: Transaction) {
		const potentialErrors = await canDeleteDispatcherV2.dispatchModuleAsync(this.dbDef.entityName, dbInstances, transaction);
		const dependencies = filterInstances(potentialErrors.map(item => (item?.conflictingIds.length || 0) === 0 ? undefined : item));
		return dependencies.length > 0 ? dependencies : undefined;
	}

	private versionUpgrades: { [K in Proto['versions']]: (items: Proto['versions'][K]) => Promise<void> } = {} as { [K in Proto['versions']]: (items: Proto['versions'][K]) => Promise<void> };

	registerVersionUpgradeProcessor<K extends Proto['versions']['versions'][number]>(version: K, processor: (items: Proto['versions']['types'][K][]) => Promise<void>) {
		this.versionUpgrades[version] = processor;
	}

	upgradeCollection = async () => {
		let docs: DocWrapperV3<Proto>[];
		const itemsCount = this.config.chunksSize;

		const query = {
			limit: {page: 0, itemsCount},
		};

		while ((docs = await this.collection.doc.query(query)).length > 0) {

			// this is old Backward compatible from before the assertion of unique ids where the doc ref is the _id of the doc
			const toDelete = docs.filter(doc => {
				return doc.ref.id !== doc.data!._id;
			});

			const instances = docs.map(d => d.data!);
			this.logWarning(`Upgrading batch(${query.limit.page}) found instances(${instances.length}) ${this.dbDef.entityName}s ....`);
			const instancesToSave: Proto['dbType'][] = [];
			await this.upgradeInstances(instances, instancesToSave);
			// @ts-ignore
			await this.collection.upgradeInstances(instancesToSave);

			if (toDelete.length > 0) {
				this.logWarning(`Need to delete docs: ${toDelete.length} ${this.dbDef.entityName}s ....`);
				await this.collection.delete.multi.allDocs(toDelete);
			}

			query.limit.page++;
		}
	};

	private async upgradeInstances(instances: Proto['dbType'][], instancesToSave: Proto['dbType'][] = []) {
		for (let i = this.config.versions.length - 1; i >= 0; i--) {
			const version = this.config.versions[i] as Proto['versions'][number];

			const instancesToUpgrade = instances.filter(instance => instance._v === version);
			const nextVersion = this.config.versions[i - 1] ?? version;
			const versionTransition = `${version} => ${nextVersion}`;
			if (instancesToUpgrade.length === 0) {
				this.logWarning(`No instances to upgrade from ${versionTransition}`);
				continue;
			}

			const upgradeProcessor = this.versionUpgrades[version];
			if (!upgradeProcessor) {
				this.logWarning(`Will not update ${instancesToUpgrade.length} instances of version ${versionTransition}`);
				this.logWarning(`No upgrade processor for: ${versionTransition}`);
			} else {
				this.logWarning(`Upgrade instances(${instancesToUpgrade.length}): ${versionTransition}`);
				await upgradeProcessor?.(instancesToUpgrade);
				instancesToSave.push(...instancesToUpgrade);
			}

			instancesToSave = filterDuplicates(instancesToSave);
			instancesToUpgrade.forEach(instance => instance._v = nextVersion);
		}
	}
}