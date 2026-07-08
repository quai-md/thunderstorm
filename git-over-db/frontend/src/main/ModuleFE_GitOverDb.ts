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
	Module,
	Second,
	UniqueId,
} from '@nu-art/ts-common';
import {DataStatus} from '@nu-art/thunderstorm-frontend/core/db-api-gen/consts';
import {
	composeBranchCacheView,
	DBDef_Branch,
	DBDef_Overlay,
	LIVE_BRANCH_ID,
	sliceOverlayEntriesForCollection,
} from '@nu-art/git-over-db-shared';
import {StorageKey_ActiveBranchId} from './consts.js';
import {ModuleFE_Branch} from './_entity/branch/ModuleFE_Branch.js';
import {ModuleFE_Overlay} from './_entity/overlay/ModuleFE_Overlay.js';

type GitOverDbParticipatingModule = {
	readonly dbDef: { readonly dbKey: string };
	cache: {
		load: (cacheFilter?: (item: Readonly<any>) => boolean) => Promise<void>;
		setCacheFilter: (filter: (item: Readonly<any>) => boolean) => void;
		loaded: boolean;
	};
	IDB: {
		query: () => Promise<DB_Object[]>;
		filter: (filter: (item: Readonly<any>) => boolean) => Promise<DB_Object[]>;
	};
	onEntriesUpdated: (items: any[], updateIDBLastSynced?: boolean) => Promise<void>;
	onEntriesDeleted: (items: any[]) => Promise<void>;
	setDataStatus: (status: DataStatus) => void;
	upgradeInstances: (instances: any[]) => Promise<any[]>;
};

type ParticipatingModuleCacheInternals = GitOverDbParticipatingModule['cache'] & {
	setCache: (cacheArray: Readonly<any[]>) => void;
};

const replaceParticipatingModuleCache = (
	cache: GitOverDbParticipatingModule['cache'],
	items: Readonly<any[]>,
) => {
	(cache as ParticipatingModuleCacheInternals).setCache(items);
	cache.loaded = true;
};

const GIT_SYNC_TIMEOUT_MS = 2 * 60 * Second;

export class ModuleFE_GitOverDb_Class extends Module {

	private readonly participatingModules = new Map<string, GitOverDbParticipatingModule>();
	private readonly pendingBranchDocsByDbKey = new Map<string, Map<UniqueId, DB_Object>>();
	private readonly pendingTombstonesByDbKey = new Map<string, Set<UniqueId>>();
	private readonly originalCacheLoad = new Map<string, GitOverDbParticipatingModule['cache']['load']>();
	private readonly originalOnEntriesUpdated = new Map<string, GitOverDbParticipatingModule['onEntriesUpdated']>();
	private readonly originalOnEntriesDeleted = new Map<string, GitOverDbParticipatingModule['onEntriesDeleted']>();
	private readonly originalSetDataStatus = new Map<string, GitOverDbParticipatingModule['setDataStatus']>();
	private readonly gitSyncModules: Array<{ getDataStatus: () => DataStatus }> = [ModuleFE_Branch, ModuleFE_Overlay];
	private overlaySyncHandlerWrapped = false;

	protected init(): void {
		super.init();
		this.wrapOverlaySyncHandler();
	}

	private isGitSyncReady = (): boolean =>
		this.gitSyncModules.every(module => module.getDataStatus() === DataStatus.ContainsData);

	resolveActiveBranchId = (): string => StorageKey_ActiveBranchId.get() ?? LIVE_BRANCH_ID;

	setActiveBranchId = (branchId: string) => {
		if (branchId === LIVE_BRANCH_ID)
			StorageKey_ActiveBranchId.delete();
		else
			StorageKey_ActiveBranchId.set(branchId);
	};

	/** Participating modules must not finish cache load until branch + overlay smart-sync completed. */
	awaitGitSync = async (): Promise<void> => {
		if (this.isGitSyncReady())
			return;

		const deadline = Date.now() + GIT_SYNC_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (this.isGitSyncReady())
				return;
			await new Promise(resolve => setTimeout(resolve, 25));
		}

		this.logWarning('git-over-db: awaitGitSync timed out; composing cache from current overlay state');
	};

	registerParticipatingModule = (module: GitOverDbParticipatingModule) => {
		const dbKey = module.dbDef.dbKey;
		if (this.participatingModules.has(dbKey))
			return;

		if (dbKey === DBDef_Overlay.dbKey || dbKey === DBDef_Branch.dbKey)
			throw new BadImplementationException(`${dbKey} cannot participate in git-over-db interception`);

		this.participatingModules.set(dbKey, module);
		this.wrapCacheLoad(module);
		this.wrapSetDataStatus(module);
		this.wrapSyncHandlers(module);
	};

	private wrapOverlaySyncHandler = () => {
		if (this.overlaySyncHandlerWrapped)
			return;
		this.overlaySyncHandlerWrapped = true;

		const originalUpdated = ModuleFE_Overlay.onEntriesUpdated.bind(ModuleFE_Overlay);
		ModuleFE_Overlay.onEntriesUpdated = async (items, updateIDBLastSynced = true) => {
			await originalUpdated(items, updateIDBLastSynced);
			for (const entry of items) {
				this.pendingBranchDocsByDbKey.get(entry.dbKey)?.delete(entry.docId);
				if (entry.kind === 'tombstone')
					this.pendingTombstonesByDbKey.get(entry.dbKey)?.delete(entry.docId);
			}
		};
	};

	private wrapSetDataStatus = (module: GitOverDbParticipatingModule) => {
		const originalSetDataStatus = module.setDataStatus.bind(module);
		this.originalSetDataStatus.set(module.dbDef.dbKey, originalSetDataStatus);

		module.setDataStatus = (status: DataStatus) => {
			if (status !== DataStatus.ContainsData || this.isGitSyncReady()) {
				originalSetDataStatus(status);
				return;
			}

			void this.awaitGitSync().then(() => originalSetDataStatus(status));
		};
	};

	private getOverlaySliceForBranch = (branchId: string, dbKey: string) => {
		const overlayEntries = ModuleFE_Overlay.cache.filter(entry => entry.branchId === branchId && entry.dbKey === dbKey);
		const syncedSlice = sliceOverlayEntriesForCollection(overlayEntries, dbKey);
		const pendingDocs = this.pendingBranchDocsByDbKey.get(dbKey);
		if (!pendingDocs?.size)
			return syncedSlice;

		const byId = new Map<UniqueId, DB_Object>(syncedSlice.documents.map(doc => [doc._id, doc]));
		for (const doc of pendingDocs.values())
			byId.set(doc._id, doc);

		const tombstones = new Set(syncedSlice.tombstonedDocIds);
		const pendingTombstones = this.pendingTombstonesByDbKey.get(dbKey);
		if (pendingTombstones)
			for (const docId of pendingTombstones)
				tombstones.add(docId);
		for (const docId of pendingDocs?.keys() ?? [])
			tombstones.delete(docId);

		return {
			documents: [...byId.values()],
			tombstonedDocIds: [...tombstones],
		};
	};

	private applyBranchOverlayToCache = async (
		module: GitOverDbParticipatingModule,
		cacheFilter?: (item: Readonly<any>) => boolean,
	) => {
		const branchId = this.resolveActiveBranchId();
		const liveItems = cacheFilter
			? await module.IDB.filter(cacheFilter)
			: await module.IDB.query();

		const {documents, tombstonedDocIds} = this.getOverlaySliceForBranch(branchId, module.dbDef.dbKey);
		const branchDocs = cacheFilter
			? documents.filter(doc => cacheFilter(doc))
			: documents;
		const composed = composeBranchCacheView(liveItems, branchDocs, tombstonedDocIds);

		if (cacheFilter)
			module.cache.setCacheFilter(cacheFilter);

		await module.upgradeInstances(composed);
		const frozenItems = composed.map(item => Object.freeze(item));
		replaceParticipatingModuleCache(module.cache, frozenItems);
	};

	private wrapCacheLoad = (module: GitOverDbParticipatingModule) => {
		const originalLoad = module.cache.load.bind(module.cache);
		this.originalCacheLoad.set(module.dbDef.dbKey, originalLoad);

		module.cache.load = async (cacheFilter?) => {
			await this.awaitGitSync();

			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalLoad(cacheFilter);

			await this.applyBranchOverlayToCache(module, cacheFilter);
		};
	};

	private wrapSyncHandlers = (module: GitOverDbParticipatingModule) => {
		const originalUpdated = module.onEntriesUpdated.bind(module);
		const originalDeleted = module.onEntriesDeleted.bind(module);
		this.originalOnEntriesUpdated.set(module.dbDef.dbKey, originalUpdated);
		this.originalOnEntriesDeleted.set(module.dbDef.dbKey, originalDeleted);

		module.onEntriesUpdated = async (items, updateIDBLastSynced = true) => {
			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalUpdated(items, updateIDBLastSynced);

			const pending = this.pendingBranchDocsByDbKey.get(module.dbDef.dbKey) ?? new Map();
			for (const item of items)
				pending.set(item._id, item);
			this.pendingBranchDocsByDbKey.set(module.dbDef.dbKey, pending);

			await this.awaitGitSync();
			await this.applyBranchOverlayToCache(module);
		};

		module.onEntriesDeleted = async (items) => {
			if (this.resolveActiveBranchId() === LIVE_BRANCH_ID)
				return originalDeleted(items);

			const dbKey = module.dbDef.dbKey;
			const pending = this.pendingBranchDocsByDbKey.get(dbKey);
			const tombstones = this.pendingTombstonesByDbKey.get(dbKey) ?? new Set();
			for (const item of items) {
				tombstones.add(item._id);
				pending?.delete(item._id);
			}
			this.pendingTombstonesByDbKey.set(dbKey, tombstones);

			await this.awaitGitSync();
			await this.applyBranchOverlayToCache(module);
		};
	};

	clearPendingBranchDocs = (dbKey?: string) => {
		if (dbKey) {
			this.pendingBranchDocsByDbKey.delete(dbKey);
			this.pendingTombstonesByDbKey.delete(dbKey);
		} else {
			this.pendingBranchDocsByDbKey.clear();
			this.pendingTombstonesByDbKey.clear();
		}
	};

	getParticipatingModules = (): ReadonlyMap<string, GitOverDbParticipatingModule> => {
		return this.participatingModules;
	};
}

export const ModuleFE_GitOverDb = new ModuleFE_GitOverDb_Class();
