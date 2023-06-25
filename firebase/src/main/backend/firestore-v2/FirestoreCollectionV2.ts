/*
 * Firebase is a simpler Typescript wrapper to all of firebase services.
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

import {
	__stringify,
	_keys,
	BadImplementationException,
	batchAction,
	compare,
	currentTimeMillis,
	CustomException,
	DB_Object,
	exists,
	filterInOut, flatArray,
	generateHex,
	MUSTNeverHappenException,
	PreDB,
	StaticLogger,
	Subset,
	UniqueId
} from '@nu-art/ts-common';
import {FirestoreType_Collection, FirestoreType_DocumentReference, FirestoreType_DocumentSnapshot} from '../firestore/types';
import {Clause_Where, FilterKeys, FirestoreQuery} from '../../shared/types';
import {FirestoreWrapperBEV2} from './FirestoreWrapperBEV2';
import {Transaction} from 'firebase-admin/firestore';
import {FirestoreInterfaceV2} from './FirestoreInterfaceV2';
import {firestore} from 'firebase-admin';
import DocumentReference = firestore.DocumentReference;
import UpdateData = firestore.UpdateData;
import FieldValue = firestore.FieldValue;
import {DocWrapperV2} from "./DocWrapperV2";


type UpdateObject<Type> = { _id: UniqueId } & UpdateData<Type>;
export const _EmptyQuery = Object.freeze({where: {}});
export const dbIdLength = 32;

export function generateId() {
	return generateHex(dbIdLength);
}

/**
 * # <ins>FirestoreException</ins>
 * @category Exceptions
 */
export class FirestoreException
	extends CustomException {

	constructor(message: string, cause?: Error) {
		super(FirestoreException, message, cause);
	}
}

/**
 * FirestoreCollection is a class for handling Firestore collections. It takes in the name, FirestoreWrapperBE instance, and uniqueKeys as parameters.
 */
export class FirestoreCollectionV2<Type extends DB_Object> {
	readonly name: string;
	readonly wrapper: FirestoreWrapperBEV2;
	readonly collection: FirestoreType_Collection;

	/**
	 * External unique as in there must never ever be two that answer the same query
	 */
	readonly externalUniqueFilter: ((object: Subset<Type>) => Clause_Where<Type>);

	/**
	 * @param name
	 * @param wrapper
	 * @param uniqueKeys
	 */
	constructor(name: string, wrapper: FirestoreWrapperBEV2, uniqueKeys?: FilterKeys<Type>) {
		this.name = name;
		this.wrapper = wrapper;
		if (!/[a-z-]{3,}/.test(name))
			StaticLogger.logWarning('Please follow name pattern for collections /[a-z-]{3,}/');

		this.collection = wrapper.firestore.collection(name);
		this.externalUniqueFilter = (item: Type) => {
			if (!uniqueKeys)
				throw new BadImplementationException('In order to use a unique query your collection MUST have a unique filter');

			return uniqueKeys.reduce((where, key: keyof Type) => {
				if (!exists(item[key]))
					throw new BadImplementationException(
						`No where properties are allowed to be null or undefined.\nWhile querying collection '${this.name}' we found property '${String(key)}' to be '${where[key]}'`);

				// @ts-ignore
				where[key] = item[key];
				return where;
			}, {} as Clause_Where<Type>);
		};
	}

	getDocWrapper = (_id: UniqueId): DocWrapperV2<Type> => {
		const doc = this.wrapper.firestore.doc(`${this.name}/${_id}`) as FirestoreType_DocumentReference<Type>;
		return new DocWrapperV2<Type>(this.wrapper, doc);
	};

	getDocWrapperFromItem = (item: PreDB<Type>): DocWrapperV2<Type> => {
		if (!exists(item._id))
			throw new BadImplementationException('Cannot create DocWrapper without _id!');

		return this.getDocWrapper(item._id!);
	};

	protected async queryByIds(all_ids: UniqueId[], transaction?: Transaction) {

		return await batchAction(all_ids, 10, async (chunk) => {
			const myQuery = FirestoreInterfaceV2.buildQuery<Type>(this, {where: {_id: {$in: chunk}}} as FirestoreQuery<Type>);
			return ((await myQuery.get()).docs as FirestoreType_DocumentSnapshot[]).map(snapshot => snapshot.data() as Type);
		});
	}

	protected async _setItem(preDBItem: PreDB<Type>, transaction?: Transaction) {
		const dbItem = this.prepareItemForSet(preDBItem);
		await this.assertDBItem(dbItem, transaction);
		const doc = this.getDocWrapperFromItem(dbItem);
		return doc.set(dbItem, transaction);
	}

	protected async _setAll(preDBItems: PreDB<Type>[], transaction?: Transaction) {
		if (transaction)
			return this._setAllTransaction(preDBItems, transaction);

		return this._setBulk(preDBItems);
	}


	protected async _setAllTransaction(preDBItems: PreDB<Type>[], transaction: Transaction): Promise<Type[]> {
		const dbItems: Type[] = [];

		await preDBItems.reduce((_transaction, _preDBItem) => {
			const _dbItem = this.prepareItemForSet(_preDBItem);
			this.getDocWrapperFromItem(_preDBItem).set(_dbItem, transaction);
			dbItems.push(_dbItem);
			return _transaction;
		}, transaction);

		return dbItems;
	}

	protected async _setBulk(preDBItems: PreDB<Type>[], transaction?: Transaction): Promise<Type[]> {
		const bulk = this.wrapper.firestore.bulkWriter();
		const dbItems: Type[] = [];

		await preDBItems.reduce((_bulk, _preDBItem) => {
			const _dbItem = this.prepareItemForSet(_preDBItem);
			_bulk.set(this.getDocWrapperFromItem(_preDBItem).ref, _dbItem);
			dbItems.push(_dbItem);
			return _bulk;
		}, bulk).close();

		return dbItems;
	}

	prepareItemForSet(preDBItem: PreDB<Type>): Type {
		const now = currentTimeMillis();
		preDBItem._id ??= generateId();
		preDBItem.__created ??= now;
		preDBItem.__updated = now;
		return preDBItem as Type;
	}

	protected async _createItem(preDBItem: PreDB<Type>, transaction?: Transaction) {
		const dbItem = this.prepareItemForCreate(preDBItem);
		await this.assertDBItem(dbItem);
		const doc = this.getDocWrapperFromItem(dbItem);
		return doc.create(dbItem, transaction);
	}

	protected async _createAll(preDBItems: PreDB<Type>[], retryOnError: boolean = false, transaction?: Transaction): Promise<Type[]> {
		if (transaction)
			return this._createAllTransaction(preDBItems, retryOnError, transaction);

		return this._createBulk(preDBItems, retryOnError);
	}

	protected async _createAllTransaction(preDBItems: PreDB<Type>[], retryOnError: boolean = false, transaction: Transaction): Promise<Type[]> {
		const dbItems: Type[] = [];

		await preDBItems.reduce((_transaction, _preDBItem) => {
			const _dbItem = this.prepareItemForCreate(_preDBItem);
			this.getDocWrapperFromItem(_dbItem).create(_dbItem, transaction);
			dbItems.push(_dbItem);
			return _transaction;
		}, transaction);

		return dbItems;
	}

	protected async _createBulk(preDBItems: PreDB<Type>[], retryOnError: boolean = false): Promise<Type[]> {
		const bulk = this.wrapper.firestore.bulkWriter();
		const dbItems: Type[] = [];
		const errors: string[] = [];
		bulk.onWriteError(error => {
			errors.push(error.message);
			return retryOnError;
		});
		await preDBItems.reduce((_bulk, _preDBItem) => {
			const _dbItem = this.prepareItemForCreate(_preDBItem);
			this.addBulkCreate(_bulk, _dbItem);
			dbItems.push(_dbItem);
			return _bulk;
		}, bulk).flush();
		if (errors.length)
			throw new FirestoreException(__stringify(errors));

		return dbItems;
	}

	private async addBulkCreate(bulk: FirebaseFirestore.BulkWriter, dbItem: Type) {
		return bulk.create(this.getDocWrapperFromItem(dbItem).ref, dbItem);
	}

	prepareItemForCreate(preDBItem: PreDB<Type>): Type {
		const now = currentTimeMillis();
		preDBItem._id ??= generateId();
		preDBItem.__updated = preDBItem.__created = now;

		return preDBItem as Type;
	}

	private async assertDBItem(dbItem: Type, transaction?: Transaction, request?: Express.Request) {
		await this.upgradeDBItem([dbItem]);
		await this.preUpsertProcessing(dbItem, transaction, request);
		this.validateImpl(dbItem);
		await this.assertUniqueness(dbItem, transaction, request);
	}

	protected _deleteUnique = async (_id: UniqueId) => {
		if (!_id)
			throw new MUSTNeverHappenException('Cannot deleteUnique without an _id!');

		await this.getDocWrapper(_id).delete();
	};

	protected async _deleteQuery(query: FirestoreQuery<Type>, transaction?: Transaction) {
		if (!exists(query) || compare(query, _EmptyQuery))
			throw new MUSTNeverHappenException('An empty query was passed to delete.query!');

		const items = await this.query.custom(query, transaction);
		return this._deleteAll(items.map(this.getDocWrapperFromItem));
	}

	protected async _deleteAll(docs: DocWrapperV2<Type>[], transaction?: Transaction) {
		if (transaction)
			return this._deleteAllTransaction(docs, transaction);

		return this._deleteBulk(docs);
	}

	protected async _deleteAllTransaction(docs: DocWrapperV2<Type>[], transaction: Transaction) {
		return docs.map(doc => doc.delete(transaction));
	}

	protected async _deleteBulk(docs: DocWrapperV2<Type>[]) {
		await this._deleteBulkRefs(docs.map(_doc => _doc.ref));
	}

	protected async _deleteBulkRefs(refs: DocumentReference[]) {
		const bulk = this.wrapper.firestore.bulkWriter();
		refs.forEach(_ref => bulk.delete(_ref));
		await bulk.close();
	}

	async deleteCollection() {
		const refs = await this.collection.listDocuments();
		await this._deleteBulkRefs(refs);
	}

	/**
	 * Get the db items from the query
	 * @param ourQuery
	 */
	async queryItems(ourQuery: FirestoreQuery<Type>): Promise<Type[]> {
		return (await this._query(ourQuery)).map(result => result.data() as Type);
	}

	private async _query(ourQuery?: FirestoreQuery<Type>): Promise<FirestoreType_DocumentSnapshot[]> {
		const myQuery = FirestoreInterfaceV2.buildQuery(this, ourQuery);
		return (await myQuery.get()).docs as FirestoreType_DocumentSnapshot[];
	}

	protected _update = async (updateData: UpdateObject<Type>, transaction?: Transaction) => {
		const doc = this.getDocWrapper(updateData._id);
		await this.prepareDataForUpdate(updateData);
		delete (updateData as UpdateData<Type>)._id;
		await doc.update(updateData, transaction);
		return doc.get();
	};

	protected _updateAll = async (updateData: UpdateObject<Type>[], transaction?: Transaction) => {
		if (transaction)
			return this._updateAllTransaction(updateData, transaction);

		return this._updateBulk(updateData);
	};

	protected _updateAllTransaction = async (updateData: UpdateObject<Type>[], transaction: Transaction) => {
		const toUpdate = await Promise.all(updateData.map(async _data => await this.prepareDataForUpdate(_data)));
		await toUpdate.reduce((_transaction, _data) => {
			delete (updateData as UpdateData<Type>)._id;
			this.getDocWrapper(_data._id).update(_data, transaction);
			return _transaction;
		}, transaction);

		return await this.query.all(updateData.map(_data => _data._id));
	};
	protected _updateBulk = async (updateData: UpdateObject<Type>[]): Promise<Type[]> => {
		const toUpdate = await Promise.all(updateData.map(async _data => await this.prepareDataForUpdate(_data)));
		const bulk = this.wrapper.firestore.bulkWriter();
		await toUpdate.reduce((_bulk, _data) => {
			delete (updateData as UpdateData<Type>)._id;
			_bulk.update(this.getDocWrapper(_data._id).ref, _data);
			return _bulk;
		}, bulk).close();

		return await this.query.all(updateData.map(_data => _data._id)) as Type[];
	};

	private async prepareDataForUpdate(updateData: UpdateObject<Type>) {
		delete updateData.__created;
		updateData.__updated = currentTimeMillis();
		this.updateDeletedFields(updateData);
		await this.assertUpdateData(updateData);
		return updateData;
	}

	/**
	 * Recursively replaces any undefined or null fields in DB item with firestore.FieldValue.delete()
	 * @param updateData: data to update in DB item
	 * @private
	 */
	private updateDeletedFields(updateData: UpdateObject<Type | Type[keyof Type]>) {
		if (typeof updateData !== 'object' || updateData === null)
			return;

		_keys(updateData).forEach(_key => {
			const _value = updateData[_key];

			if (!exists(_value)) {
				// @ts-ignore
				updateData[_key] = FieldValue.delete();
			} else {
				this.updateDeletedFields(_value as UpdateObject<Type | Type[keyof Type]>);
			}
		});
	}

	private async assertUpdateData(updateData: UpdateData<Type>) {
	}

	private _upsert = async (item: PreDB<Type> | UpdateObject<Type>, transaction?: Transaction): Promise<Type> => {
		let dbItem;
		if (exists(item._id)) {
			dbItem = this.getDocWrapper(item._id!).get();
		}

		if (dbItem)
			return await this.update.item(item as UpdateObject<Type>, transaction);
		else
			return await this.create.item(item as PreDB<Type>, transaction)
	};

	private _upsertAll = async (items: PreDB<Type>[] | UpdateObject<Type>[], transaction?: Transaction): Promise<Type[]> => {
		const {filteredIn: hasIdItems, filteredOut: noIdItems} = filterInOut<PreDB<Type> | UpdateObject<Type>>(items, _item => exists(_item._id));
		const toCreate = noIdItems;
		const toUpdate: UpdateObject<Type>[] = [];

		const dbItems = await this.query.all(hasIdItems.map(_item => _item._id!));
		dbItems.forEach((_item, i) => !exists(_item) ? toCreate.push(hasIdItems[i]) : toUpdate.push(hasIdItems[i] as UpdateObject<Type>));

		return flatArray(await Promise.all([
			this.update.all(toUpdate, transaction),
			this.create.all(toCreate as PreDB<Type>[], transaction)
		]))
	};

	private getAll = async (_ids: UniqueId[], transaction?: Transaction): Promise<(Type | undefined)[]> => {
		if (_ids.length === 0)
			return []
		return (await (transaction ?? this.wrapper.firestore).getAll(..._ids.map(id => this.getDocWrapper(id).ref))).map(doc => doc.data() as Type | undefined);
	}

	/**
	 * Get DocWrappers per the db objects from the query
	 * @param ourQuery
	 */
	async newQuery(ourQuery: FirestoreQuery<Type>): Promise<DocWrapperV2<Type>[]> {
		const docs = await this._query(ourQuery) as FirestoreType_DocumentSnapshot<Type>[];
		return docs.filter(doc => doc.exists).map(doc => new DocWrapperV2<Type>(this.wrapper, doc.ref, doc.data()));
	}

	private upgradeDBItem(dbItems: Type[]) {
		//todo - maybe should be filled only in extending modules
	}

	private async preUpsertProcessing(dbItem: Type, transaction?: Transaction, request?: Express.Request) {
		//todo - maybe should be filled only in extending modules
	}

	private validateImpl(dbItem: Type) {
		//todo validation using validator
	}

	private assertUniqueness(dbItem: Type, transaction?: Transaction, request?: Express.Request) {
	}

	set = {
		item: async (item: PreDB<Type>, transaction?: Transaction) => await this._setItem(item, transaction),
		all: async (items: PreDB<Type>[], transaction?: Transaction) => await this._setAll(items, transaction),
	};

	query = {
		unique: async (_id: UniqueId, transaction?: Transaction) => {
			return await this.getDocWrapper(_id).get(transaction);
		},
		all: this.getAll,
		custom: async (query?: FirestoreQuery<Type>, transaction?: Transaction) => {
			const myQuery = FirestoreInterfaceV2.buildQuery<Type>(this, query);
			if (transaction)
				return (await transaction.get(myQuery)).docs.map(snapshot => snapshot.data() as Type);

			return ((await myQuery.get()).docs as FirestoreType_DocumentSnapshot[]).map(snapshot => snapshot.data() as Type);
		},
	};

	create = {
		item: async (item: PreDB<Type>, transaction?: Transaction) => await this._createItem(item, transaction),
		all: async (items: PreDB<Type>[], transaction?: Transaction) => await this._createAll(items, false, transaction),
	};

	update = {
		item: this._update,
		all: this._updateAll,
	};

	upsert = {
		item: this._upsert,
		all: this._upsertAll
	};

	delete = {
		unique: this._deleteUnique,
		item: async (item: PreDB<Type>, transaction?: Transaction) => await this.getDocWrapperFromItem(item).delete(transaction),
		all: async (_ids: UniqueId[], transaction?: Transaction) => await this._deleteAll(_ids.map(_id => this.getDocWrapper(_id)), transaction),
		allItems: async (items: PreDB<Type>[], transaction?: Transaction) => await this._deleteAll(items.map(_item => this.getDocWrapperFromItem(_item)), transaction),
		query: this._deleteQuery
	};
}