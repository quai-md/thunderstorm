/*
 * Git-over-DB capability — sparse overlay branching for Thunderstorm DB modules.
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
	BadImplementationException,
	currentTimeMillis,
	DB_Object,
	DBProto,
	exists,
	Module,
	MUSTNeverHappenException,
	UniqueId,
} from '@nu-art/ts-common';
import {DBApiConfigV3, ModuleBE_BaseDB} from '@nu-art/thunderstorm-backend';
import {
	DBDef_Branch,
	DBDef_Overlay,
	DB_OverlayEntry,
	LIVE_BRANCH_ID,
	overlayEntryId,
} from '@nu-art/git-over-db-shared';
import {Transaction} from 'firebase-admin/firestore';
import {MemKey_ActiveBranchId} from './consts.js';
import {ModuleBE_OverlayDB} from './_entity/overlay/ModuleBE_OverlayDB.js';

type ParticipatingModule = ModuleBE_BaseDB<DBProto<any>, DBApiConfigV3<DBProto<any>>>;

type WrappedWritePaths = {
	originalSetItem: ParticipatingModule['set']['item'];
	originalCreateItem: ParticipatingModule['create']['item'];
	originalDeleteItem: ParticipatingModule['delete']['item'];
};

export class ModuleBE_GitOverDb_Class extends Module {

	private readonly participatingModules = new Map<string, ParticipatingModule>();
	private readonly wrappedPaths = new Map<string, WrappedWritePaths>();

	resolveActiveBranchId = (): string => {
		return MemKey_ActiveBranchId.get() ?? LIVE_BRANCH_ID;
	};

	setActiveBranchId = (branchId: string) => {
		if (branchId === LIVE_BRANCH_ID) {
			MemKey_ActiveBranchId.delete();
			return;
		}
		MemKey_ActiveBranchId.set(branchId);
	};

	registerParticipatingModule = (module: ParticipatingModule) => {
		const dbKey = module.dbDef.dbKey;
		if (this.participatingModules.has(dbKey))
			return;

		if (dbKey === DBDef_Overlay.dbKey || dbKey === DBDef_Branch.dbKey)
			throw new BadImplementationException(`${dbKey} cannot participate in git-over-db interception`);

		this.participatingModules.set(dbKey, module);
		this.wrapWritePaths(module);
	};

	private wrapWritePaths = (module: ParticipatingModule) => {
		const dbKey = module.dbDef.dbKey;
		const wrapped: WrappedWritePaths = {
			originalSetItem: module.set.item.bind(module.set),
			originalCreateItem: module.create.item.bind(module.create),
			originalDeleteItem: module.delete.item.bind(module.delete),
		};
		this.wrappedPaths.set(dbKey, wrapped);

		module.set = Object.freeze({
			...module.set,
			item: async (preDBItem, transaction) => {
				if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
					return wrapped.originalSetItem(preDBItem, transaction);
				return this.upsertOverlayDocument(module, preDBItem, transaction);
			},
		});

		module.create = Object.freeze({
			...module.create,
			item: async (preDBItem, transaction) => {
				if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
					return wrapped.originalCreateItem(preDBItem, transaction);
				return this.upsertOverlayDocument(module, preDBItem, transaction);
			},
		});

		module.delete = Object.freeze({
			...module.delete,
			item: async (item, transaction) => {
				if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
					return wrapped.originalDeleteItem(item, transaction);
				return this.tombstoneOverlayDocument(module, item, transaction);
			},
		});
	};

	private upsertOverlayDocument = async <Proto extends DBProto<any>>(
		module: ModuleBE_BaseDB<Proto>,
		preDBItem: Proto['uiType'],
		transaction?: Transaction,
	): Promise<Proto['dbType']> => {
		const branchId = this.resolveActiveBranchId();
		const docId = this.resolveDocId(preDBItem);
		const {origin, baseUpdated} = await this.resolveOrigin(module, docId, branchId, transaction);
		const now = currentTimeMillis();
		const document = {...preDBItem, _id: docId, __updated: now} as DB_Object;

		const overlayEntry: DB_OverlayEntry = {
			_id: overlayEntryId(branchId, module.dbDef.dbKey, docId),
			branchId,
			dbKey: module.dbDef.dbKey,
			docId,
			kind: 'document',
			document,
			origin,
			baseUpdated,
			__created: now,
			__updated: now,
		};

		await ModuleBE_OverlayDB.set.item(overlayEntry, transaction);
		return document as Proto['dbType'];
	};

	private tombstoneOverlayDocument = async <Proto extends DBProto<any>>(
		module: ModuleBE_BaseDB<Proto>,
		item: Proto['uiType'],
		transaction?: Transaction,
	): Promise<Proto['dbType']> => {
		const branchId = this.resolveActiveBranchId();
		const docId = this.resolveDocId(item);
		const {origin, baseUpdated} = await this.resolveOrigin(module, docId, branchId, transaction);
		const now = currentTimeMillis();

		const overlayEntry: DB_OverlayEntry = {
			_id: overlayEntryId(branchId, module.dbDef.dbKey, docId),
			branchId,
			dbKey: module.dbDef.dbKey,
			docId,
			kind: 'tombstone',
			origin,
			baseUpdated,
			__created: now,
			__updated: now,
		};

		await ModuleBE_OverlayDB.set.item(overlayEntry, transaction);
		return item as Proto['dbType'];
	};

	private resolveDocId = (item: { _id?: UniqueId }): UniqueId => {
		if (!exists(item._id))
			throw new BadImplementationException('Branch write requires _id on document');
		return item._id;
	};

	private resolveOrigin = async <Proto extends DBProto<any>>(
		module: ModuleBE_BaseDB<Proto>,
		docId: UniqueId,
		branchId: UniqueId,
		transaction?: Transaction,
	): Promise<{ origin: DB_Object; baseUpdated: number }> => {
		const existingOverlay = await ModuleBE_OverlayDB.query.unManipulatedQuery({
			where: {_id: overlayEntryId(branchId, module.dbDef.dbKey, docId)},
			limit: 1,
		}, transaction);

		if (existingOverlay[0])
			return {origin: existingOverlay[0].origin, baseUpdated: existingOverlay[0].baseUpdated};

		const liveDocs = await module.query.unManipulatedQuery({where: {_id: docId}, limit: 1}, transaction);
		const liveDoc = liveDocs[0];
		if (liveDoc)
			return {origin: liveDoc, baseUpdated: liveDoc.__updated};

		const emptyOrigin = {_id: docId, __created: currentTimeMillis(), __updated: 0} as DB_Object;
		return {origin: emptyOrigin, baseUpdated: 0};
	};

	queryOverlayForBranch = async (branchId: UniqueId, dbKey?: string): Promise<DB_OverlayEntry[]> => {
		if (branchId === LIVE_BRANCH_ID)
			return [];

		const where = dbKey
			? {branchId, dbKey}
			: {branchId};

		return ModuleBE_OverlayDB.query.unManipulatedQuery({where});
	};

	applyMerge = async (_branchId: UniqueId, _resolutions: unknown[]): Promise<void> => {
		throw new MUSTNeverHappenException('applyMerge is not implemented yet');
	};
}

export const ModuleBE_GitOverDb = new ModuleBE_GitOverDb_Class();
