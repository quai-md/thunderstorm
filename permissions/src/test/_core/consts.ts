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

import {generateHex, ModuleManager} from '@nu-art/ts-common';
import {ModuleBE_Auth} from '@nu-art/google-services/backend';
import {FIREBASE_DEFAULT_PROJECT_ID, ModuleBE_Firebase} from '@nu-art/firebase/backend';
import {Storm} from '@nu-art/thunderstorm/backend';
import {RouteResolver_Dummy} from '@nu-art/thunderstorm/backend/modules/server/route-resolvers/RouteResolver_Dummy';
import {ModuleBE_Permissions, ModuleBE_PermissionsAssert} from '../../main/backend';
import {ModuleBE_v2_AccountDB, ModuleBE_v2_SessionDB} from '@nu-art/user-account/backend';
import {ModuleBE_PermissionProject} from '../../main/backend/modules/management/ModuleBE_PermissionProject';
import {ModuleBE_PermissionDomain} from '../../main/backend/modules/management/ModuleBE_PermissionDomain';
import {ModuleBE_PermissionAccessLevel} from '../../main/backend/modules/management/ModuleBE_PermissionAccessLevel';
import {ModuleBE_PermissionApi} from '../../main/backend/modules/management/ModuleBE_PermissionApi';
import {ModuleBE_PermissionUserDB} from '../../main/backend/modules/assignment/ModuleBE_PermissionUserDB';
import {ModuleBE_PermissionGroup} from '../../main/backend/modules/assignment/ModuleBE_PermissionGroup';
import {ModuleBE_v2_SyncManager} from '@nu-art/db-api-generator/backend';

export const Default_TestEmail = 'test@test.test';
export const Default_TestPassword = '1234';
export const TestProject__Name = 'Test Project';

const config = {
	project_id: generateHex(4),
	databaseURL: 'http://localhost:8102/?ns=quai-md-dev',
	isEmulator: true
};
ModuleBE_Auth.setDefaultConfig({auth: {[FIREBASE_DEFAULT_PROJECT_ID]: config}});
ModuleBE_Permissions.setDefaultConfig({project: {_id: config.project_id, name: 'test project'}});
ModuleBE_v2_AccountDB.setDefaultConfig({canRegister: true});
export const firestore = ModuleBE_Firebase.createAdminSession().getFirestoreV2();

// @ts-ignore
ModuleManager.resetForTests();


const accountModules = [
	ModuleBE_v2_SyncManager,
	ModuleBE_v2_AccountDB,
	ModuleBE_v2_SessionDB];
const permissionModules = [
	ModuleBE_PermissionProject,
	ModuleBE_PermissionDomain,
	ModuleBE_PermissionAccessLevel,
	ModuleBE_PermissionApi,
	ModuleBE_PermissionUserDB,
	ModuleBE_PermissionGroup,
	ModuleBE_PermissionsAssert,
	ModuleBE_Permissions];
new Storm()
	.addModulePack(accountModules)
	.addModulePack(permissionModules)
	.setConfig({isDebug: true})
	.setInitialRouteResolver(new RouteResolver_Dummy())
	.init()
	.build();