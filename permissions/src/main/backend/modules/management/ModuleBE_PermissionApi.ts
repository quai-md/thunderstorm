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

import {ServerApi} from '@nu-art/thunderstorm/backend';
import {filterDuplicates, PreDB} from '@nu-art/ts-common';
import {MemKey_AccountId} from '@nu-art/user-account/backend';
import {DB_PermissionApi, DBDef_PermissionApi} from '../../shared';
import {Clause_Where} from '@nu-art/firebase';
import {ModuleBE_PermissionProject} from './ModuleBE_PermissionProject';
import {ModuleBE_PermissionAccessLevel} from './ModuleBE_PermissionAccessLevel';
import {ModuleBE_BaseDBV2} from '@nu-art/db-api-generator/backend/ModuleBE_BaseDBV2';
import {firestore} from 'firebase-admin';
import Transaction = firestore.Transaction;


export class ModuleBE_PermissionApi_Class
	extends ModuleBE_BaseDBV2<DB_PermissionApi> {

	constructor() {
		super(DBDef_PermissionApi);
	}

	protected externalFilter(item: DB_PermissionApi): Clause_Where<DB_PermissionApi> {
		const {projectId, path} = item;
		return {projectId, path};
	}

	protected internalFilter(item: DB_PermissionApi): Clause_Where<DB_PermissionApi>[] {
		const {projectId, path} = item;
		return [{projectId, path}];
	}

	protected async preWriteProcessing(dbInstance: DB_PermissionApi, t?: Transaction) {
		await ModuleBE_PermissionProject.query.uniqueAssert(dbInstance.projectId);

		dbInstance._auditorId = MemKey_AccountId.get();

		// need to assert that all the permissions levels exists in the db
		const _permissionsIds = dbInstance.accessLevelIds;
		if (!_permissionsIds || _permissionsIds.length <= 0)
			return;

		const permissionsIds = filterDuplicates(_permissionsIds);
		await Promise.all(permissionsIds.map(id => ModuleBE_PermissionAccessLevel.query.uniqueAssert(id)));
		dbInstance.accessLevelIds = permissionsIds;
	}

	registerApis(projectId: string, routes: string[]) {
		return this.runTransaction(async (transaction: Transaction) => {
			const existingProjectApis = await this.query.custom({where: {projectId: projectId}}, transaction);
			const apisToAdd: PreDB<DB_PermissionApi>[] = routes
				.filter(path => !existingProjectApis.find(api => api.path === path))
				.map(path => ({path, projectId: projectId, _auditorId: MemKey_AccountId.get()}));

			return this.set.all(apisToAdd, transaction);
		});
	}

	apiUpsert(): ServerApi<any> | undefined {
		return;
	}
}

export const ModuleBE_PermissionApi = new ModuleBE_PermissionApi_Class();
