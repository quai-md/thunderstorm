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
	DB_Object,
	DBProto,
	Module,
	TypedMap,
	UniqueId,
} from '@nu-art/ts-common';
import {ModuleFE_BaseDB} from '@nu-art/thunderstorm-frontend';
import {
	composeBranchCacheView,
	DBDef_Branch,
	DBDef_Overlay,
	DB_OverlayEntry,
	LIVE_BRANCH_ID,
	sliceOverlayEntriesForCollection,
} from '@nu-art/git-over-db-shared';
import {StorageKey_ActiveBranchId} from './consts.js';

type ParticipatingModule = ModuleFE_BaseDB<DBProto<any>, any>;

class BranchOverlayStore {
	private readonly documentsByBranchDbKey = new Map<string, Map<UniqueId, DB_Object>>();
	private readonly tombstonesByBranchDbKey = new Map<string, Set<UniqueId>>();

	private key = (branchId: string, dbKey: string) => `${branchId}|${dbKey}`;

	replaceFromOverlayEntries = (branchId: string, entries: readonly DB_OverlayEntry[]) => {
		const byDbKey = new Map<string, DB_OverlayEntry[]>();
		for (const entry of entries) {
			if (entry.branchId !== branchId)
				continue;
			const list = byDbKey.get(entry.dbKey) ?? [];
			list.push(entry);
			byDbKey.set(entry.dbKey, list);
		}

		for (const [dbKey, dbEntries] of byDbKey.entries()) {
			const slice = sliceOverlayEntriesForCollection(dbEntries, dbKey);
			const docMap = new Map(slice.documents.map(doc => [doc._id, doc]));
			this.documentsByBranchDbKey.set(this.key(branchId, dbKey), docMap);
			this.tombstonesByBranchDbKey.set(this.key(branchId, dbKey), new Set(slice.tombstonedDocIds));
		}
	};

	upsertDocuments = (branchId: string, dbKey: string, docs: readonly DB_Object[]) => {
		const storeKey = this.key(branchId, dbKey);
		const docMap = this.documentsByBranchDbKey.get(storeKey) ?? new Map();
		for (const doc of docs) {
			docMap.set(doc._id, doc);
			this.tombstonesByBranchDbKey.get(storeKey)?.delete(doc._id);
		}
		this.documentsByBranchDbKey.set(storeKey, docMap);
	};

	tombstoneDocuments = (branchId: string, dbKey: string, docIds: readonly UniqueId[]) => {
		const storeKey = this.key(branchId, dbKey);
		const tombstones = this.tombstonesByBranchDbKey.get(storeKey) ?? new Set();
		const docMap = this.documentsByBranchDbKey.get(storeKey);
		for (const docId of docIds) {
			tombstones.add(docId);
			docMap?.delete(docId);
		}
		this.tombstonesByBranchDbKey.set(storeKey, tombstones);
	};

	getSlice = (branchId: string, dbKey: string) => {
		const storeKey = this.key(branchId, dbKey);
		return {
			documents: [...(this.documentsByBranchDbKey.get(storeKey)?.values() ?? [])],
			tombstonedDocIds: [...(this.tombstonesByBranchDbKey.get(storeKey) ?? [])],
		};
	};

	clearBranch = (branchId: string) => {
		for (const key of [...this.documentsByBranchDbKey.keys()])
			if (key.startsWith(`${branchId}|`))
				this.documentsByBranchDbKey.delete(key);
		for (const key of [...this.tombstonesByBranchDbKey.keys()])
			if (key.startsWith(`${branchId}|`))
				this.tombstonesByBranchDbKey.delete(key);
	};
}

export class ModuleFE_GitOverDb_Class extends Module {

	private readonly participatingModules = new Map<string, ParticipatingModule>();
	private readonly branchOverlayStore = new BranchOverlayStore();
	private readonly originalCacheLoad = new Map<string, ParticipatingModule['cache']['load']>();
	private readonly originalOnEntriesUpdated = new Map<string, ParticipatingModule['onEntriesUpdated']>();
	private readonly originalOnEntriesDeleted = new Map<string, ParticipatingModule['onEntriesDeleted']>();

	resolveActiveBranchId = (): string => StorageKey_ActiveBranchId.get() ?? LIVE_BRANCH_ID;

	setActiveBranchId = (branchId: string) => {
		if (branchId === LIVE_BRANCH_ID)
			StorageKey_ActiveBranchId.delete();
		else
			StorageKey_ActiveBranchId.set(branchId);
	};

	loadBranchOverlayEntries = (branchId: string, entries: readonly DB_OverlayEntry[]) => {
		this.branchOverlayStore.replaceFromOverlayEntries(branchId, entries);
	};

	registerParticipatingModule = (module: ParticipatingModule) => {
		const dbKey = module.dbDef.dbKey;
		if (this.participatingModules.has(dbKey))
			return;

		if (dbKey === DBDef_Overlay.dbKey || dbKey === DBDef_Branch.dbKey)
			throw new BadImplementationException(`${dbKey} cannot participate in git-over-db interception`);

		this.participatingModules.set(dbKey, module);
		this.wrapCacheLoad(module);
		this.wrapSyncHandlers(module);
	};

	private wrapCacheLoad = (module: ParticipatingModule) => {
		const originalLoad = module.cache.load.bind(module.cache);
		this.originalCacheLoad.set(module.dbDef.dbKey, originalLoad);

		module.cache.load = async (cacheFilter?) => {
			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalLoad(cacheFilter);

			const branchId = this.resolveActiveBranchId();
			let liveItems = cacheFilter
				? await module.IDB.filter(cacheFilter)
				: await module.IDB.query();

			const {documents, tombstonedDocIds} = this.branchOverlayStore.getSlice(branchId, module.dbDef.dbKey);
			const branchDocs = cacheFilter ? documents.filter(cacheFilter) : documents;
			const composed = composeBranchCacheView(liveItems, branchDocs, tombstonedDocIds);

			if (cacheFilter)
				module.cache.setCacheFilter(cacheFilter);

			await module.upgradeInstances(composed);
			const frozenItems = composed.map(item => Object.freeze(item));
			// @ts-ignore — MemCache.setCache is protected; instance override is the approved seam.
			module.cache.setCache(frozenItems);
			module.cache.loaded = true;
		};
	};

	private wrapSyncHandlers = (module: ParticipatingModule) => {
		const originalUpdated = module.onEntriesUpdated.bind(module);
		const originalDeleted = module.onEntriesDeleted.bind(module);
		this.originalOnEntriesUpdated.set(module.dbDef.dbKey, originalUpdated);
		this.originalOnEntriesDeleted.set(module.dbDef.dbKey, originalDeleted);

		module.onEntriesUpdated = async (items, updateIDBLastSynced = true) => {
			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalUpdated(items, updateIDBLastSynced);

			const branchId = this.resolveActiveBranchId();
			this.branchOverlayStore.upsertDocuments(branchId, module.dbDef.dbKey, items);
			await module.cache.load();
		};

		module.onEntriesDeleted = async (items) => {
			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalDeleted(items);

			const branchId = this.resolveActiveBranchId();
			this.branchOverlayStore.tombstoneDocuments(branchId, module.dbDef.dbKey, items.map(item => item._id));
			await module.cache.load();
		};
	};

	getParticipatingModules = (): TypedMap<ParticipatingModule> => {
		return {...this.participatingModules};
	};
}

export const ModuleFE_GitOverDb = new ModuleFE_GitOverDb_Class();
