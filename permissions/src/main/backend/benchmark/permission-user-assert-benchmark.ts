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

import {batchAction, currentTimeMillis, filterInstances, generateHex, PreDB, StaticLogger} from '@nu-art/ts-common';
import {ModuleBE_PermissionsAssert} from '../modules/ModuleBE_PermissionsAssert';
import {ModuleBE_PermissionProject} from '../modules/management/ModuleBE_PermissionProject';
import {ModuleBE_PermissionDomain} from '../modules/management/ModuleBE_PermissionDomain';
import {ModuleBE_PermissionAccessLevel} from '../modules/management/ModuleBE_PermissionAccessLevel';
import {ModuleBE_PermissionApi} from '../modules/management/ModuleBE_PermissionApi';
import {ModuleBE_PermissionGroup} from '../modules/assignment/ModuleBE_PermissionGroup';
import {ModuleBE_PermissionUserDB} from '../modules/assignment/ModuleBE_PermissionUserDB';
import {DB_PermissionGroup, User_Group} from '../../shared';


function makeAlphaBetIdForTestOnly(length: number) {
	let result = '';
	const characters = `abcdefghijklmnopqrstuvwxyz`;
	const charactersLength = characters.length;

	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

export async function testUserPermissionsTime() {
	StaticLogger.logInfo('---￿Inside of permissions test---');
	const projectId = 'project-test-ten';
	const apiId = generateHex(32);
	const userId = generateHex(32);
	const apiPath = 'v1/test/test-it10';
	const userUuid = 'test10@intuitionrobotics.com';
	const permissionId = generateHex(32);
	const domainId = generateHex(32);
	const permissionValue = 50;
	const customField = {UnitId: 'eq1'};
	await ModuleBE_PermissionProject.set.item({_id: projectId, name: 'project test'});
	await ModuleBE_PermissionDomain.set.item({_id: domainId, projectId: projectId, namespace: 'domain-test'});
	const accessLevel = await ModuleBE_PermissionAccessLevel.set.item({
		_id: permissionId,
		name: 'test-permission',
		domainId,
		value: permissionValue
	});
	await ModuleBE_PermissionApi.set.item({
		projectId: projectId,
		_id: apiId,
		path: apiPath,
		accessLevelIds: [permissionId]
	});
	const groupIdArray: User_Group[] = [];

	const dbInstances: PreDB<DB_PermissionGroup>[] = [];
	for (let counter = 0; counter < 100; counter++) {
		const groupId = generateHex(32);
		const baseAccessLevel = {domainId: accessLevel.domainId, value: accessLevel.value};
		dbInstances.push({
			_id: groupId,
			accessLevelIds: [accessLevel._id],
			__accessLevels: [baseAccessLevel],
			customFields: [customField],
			label: `group-${makeAlphaBetIdForTestOnly(5)}`
		});
		groupIdArray.push({groupId, customField: {test: 'test'}});
	}

	await ModuleBE_PermissionGroup.set.all(dbInstances);

	await ModuleBE_PermissionUserDB.set.item({_id: userId, accountId: userUuid, groups: groupIdArray});

	const tests = new Array<number>().fill(0, 0, 50);
	const durations: number[] = await Promise.all(tests.map(test => runAssertion(projectId, apiPath, customField)));
	const sum = durations.reduce((_sum, val) => _sum + val, 0);
	StaticLogger.logInfo(`Call to assertion on ${tests.length} call took on agerage ${sum / tests.length}ms`);

	// ----deletes db documents---
	await ModuleBE_PermissionUserDB.delete.unique(userId);
	await batchAction(filterInstances(dbInstances.map(i => i._id)), 10, chunk => ModuleBE_PermissionGroup.delete.query({where: {_id: {$in: chunk}}}));
	await ModuleBE_PermissionAccessLevel.delete.unique(permissionId);
	await ModuleBE_PermissionDomain.delete.unique(domainId);
	await ModuleBE_PermissionApi.delete.unique(apiId);
	await ModuleBE_PermissionProject.delete.unique(projectId);
}

async function runAssertion(projectId: string, apiPath: string, customField: { UnitId: string }) {
	const start = currentTimeMillis();
	await ModuleBE_PermissionsAssert.assertUserPermissions(projectId, apiPath, customField);
	const runTime = currentTimeMillis() - start;
	StaticLogger.logInfo(`Call to assertion took ${runTime}ms`);
	return runTime;
}
