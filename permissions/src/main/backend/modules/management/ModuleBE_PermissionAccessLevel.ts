/*
 * Permissions management system, define access level for each of
 * your server apis, and restrict users by giving them access levels
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

import {FirestoreTransaction} from '@nu-art/firebase/backend';
import {ApiException, batchActionParallel, dbObjectToId, filterDuplicates, flatArray} from '@nu-art/ts-common';
import {MemKey_AccountId} from '@nu-art/user-account/backend';
import {DB_PermissionAccessLevel, DBDef_PermissionAccessLevel} from '../../shared';
import {Clause_Where, DB_EntityDependency} from '@nu-art/firebase';
import {ModuleBE_PermissionDomain} from './ModuleBE_PermissionDomain';
import {ModuleBE_PermissionApi} from './ModuleBE_PermissionApi';
import {ModuleBE_PermissionGroup} from '../assignment/ModuleBE_PermissionGroup';
import {CanDeletePermissionEntities} from '../../core/can-delete';
import {PermissionTypes} from '../../../shared/types';
import {firestore} from 'firebase-admin';
import {PostWriteProcessingData} from '@nu-art/firebase/backend/firestore-v2/FirestoreCollectionV2';
import {ModuleBE_BaseDBV2} from '@nu-art/thunderstorm/backend';
import Transaction = firestore.Transaction;


export class ModuleBE_PermissionAccessLevel_Class
	extends ModuleBE_BaseDBV2<DB_PermissionAccessLevel>
	implements CanDeletePermissionEntities<'Domain', 'Level'> {

	constructor() {
		// super(CollectionName_Level, LevelDB_Class._validator, 'level');
		super(DBDef_PermissionAccessLevel);
	}

	__canDeleteEntities = async <T extends 'Domain'>(type: T, items: PermissionTypes[T][]): Promise<DB_EntityDependency<'Level'>> => {
		let conflicts: DB_PermissionAccessLevel[] = [];
		const dependencies: Promise<DB_PermissionAccessLevel[]>[] = [];

		dependencies.push(batchActionParallel(items.map(dbObjectToId), 10, async ids => this.query.custom({where: {domainId: {$in: ids}}})));
		if (dependencies.length)
			conflicts = flatArray(await Promise.all(dependencies));

		return {collectionKey: 'Level', conflictingIds: conflicts.map(dbObjectToId)};
	};

	protected internalFilter(item: DB_PermissionAccessLevel): Clause_Where<DB_PermissionAccessLevel>[] {
		const {domainId, name, value} = item;
		return [{domainId, name}, {domainId, value}];
	}

	protected async preWriteProcessing(dbInstance: DB_PermissionAccessLevel, t?: Transaction) {
		await ModuleBE_PermissionDomain.query.uniqueAssert(dbInstance.domainId);

		dbInstance._auditorId = MemKey_AccountId.get();
	}

	protected async postWriteProcessing(data: PostWriteProcessingData<DB_PermissionAccessLevel>): Promise<void> {
		const deleted = data.deleted ? (Array.isArray(data.deleted) ? data.deleted : [data.deleted]) : [];
		const updated = data.updated ? (Array.isArray(data.updated) ? data.updated : [data.updated]) : [];

		//Collect all apis that hold an access level id in the levels that have changed
		const deletedIds = deleted.map(dbObjectToId);
		const levelIds = [...deletedIds, ...updated.map(dbObjectToId)];
		const connectedApis = await batchActionParallel(levelIds, 10, async ids => await ModuleBE_PermissionApi.query.custom({where: {accessLevelIds: {$aca: ids}}}));

		deletedIds.forEach(id => {
			//For each deleted level remove it from any api that held it
			connectedApis.forEach(api => {
				api.accessLevelIds = api.accessLevelIds?.filter(i => i !== id);
			});
		});

		//Send all apis to upsert so their _accessLevels update
		await ModuleBE_PermissionApi.set.all(connectedApis);
		return super.postWriteProcessing(data);
	}

	protected async assertDeletion(transaction: FirestoreTransaction, dbInstance: DB_PermissionAccessLevel) {
		const groups = await ModuleBE_PermissionGroup.query.custom({where: {accessLevelIds: {$ac: dbInstance._id}}});
		const apis = await ModuleBE_PermissionApi.query.custom({where: {accessLevelIds: {$ac: dbInstance._id}}});

		if (groups.length || apis.length)
			throw new ApiException(403, 'You trying delete access level that associated with users/groups/apis, you need delete the associations first');
	}
}

export function checkDuplicateLevelsDomain(levels: DB_PermissionAccessLevel[]) {
	const domainIds = levels.map(level => level.domainId);
	const filteredDomainIds = filterDuplicates(domainIds);
	if (filteredDomainIds.length !== domainIds.length)
		throw new ApiException(422, 'You trying test-add-data duplicate accessLevel with the same domain');
}

export const ModuleBE_PermissionAccessLevel = new ModuleBE_PermissionAccessLevel_Class();
