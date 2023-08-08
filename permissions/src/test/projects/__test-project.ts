import {TestSuite} from '@nu-art/ts-common/testing/types';
import {BadImplementationException, PreDB, reduceToMap, TypedMap, UniqueId} from '@nu-art/ts-common';
import {DB_PermissionAccessLevel, DB_PermissionDomain, DB_PermissionGroup} from '../../main';
import {ModuleBE_PermissionProject} from '../../main/backend/modules/management/ModuleBE_PermissionProject';
import {ModuleBE_PermissionApi} from '../../main/backend/modules/management/ModuleBE_PermissionApi';
import {ModuleBE_PermissionDomain} from '../../main/backend/modules/management/ModuleBE_PermissionDomain';
import {ModuleBE_PermissionAccessLevel} from '../../main/backend/modules/management/ModuleBE_PermissionAccessLevel';
import {ModuleBE_PermissionsAssert} from '../../main/backend';
import {MemStorage} from '@nu-art/ts-common/mem-storage/MemStorage';
import {testSuiteTester} from '@nu-art/ts-common/testing/consts';
import {
	Groups_ToCreate,
	Test_AccessLevel_Admin,
	Test_AccessLevel_Delete,
	Test_AccessLevel_NoAccess,
	Test_AccessLevel_Read,
	Test_AccessLevel_Write,
	Test_Domain1,
	TestProject__Name
} from '../_core/consts';
import {ModuleBE_PermissionGroup} from '../../main/backend/modules/assignment/ModuleBE_PermissionGroup';
import {MemKey_AccountId} from '@nu-art/user-account/backend';
import {ModuleBE_PermissionUserDB} from '../../main/backend/modules/assignment/ModuleBE_PermissionUserDB';


type InputPermissionsSetup = {
	setup: {
		projects: {
			name: string,
			apis: { path: string, domain: string, levelNames: string[] }[],
			domains: {
				namespace: string,
				levels: { name: string, value: number }[]
			}[]
		}[];
	},
	userLevels: { domain: string, levelName: string }[];
	check: (projectId: UniqueId) => Promise<any>;
}
type BasicProjectTest = TestSuite<InputPermissionsSetup, boolean>;

const TestCases_Basic: BasicProjectTest['testcases'] = [
	{
		description: 'Create Project',
		input: {
			setup: {
				projects: [{
					name: TestProject__Name,
					apis: [
						{path: 'v1/stam', domain: Test_Domain1, levelNames: ['Read', 'Delete']}
					],
					domains: [{
						namespace: Test_Domain1,
						levels: [
							{name: Test_AccessLevel_NoAccess, value: 0},
							{name: Test_AccessLevel_Read, value: 100},
							{name: Test_AccessLevel_Write, value: 200},
							{name: Test_AccessLevel_Delete, value: 300},
							{name: Test_AccessLevel_Admin, value: 1000},
						]
					}],
				}],
			},
			userLevels: [{domain: Test_Domain1, levelName: Test_AccessLevel_Write}],
			check: async (projectId: UniqueId) => {
				await ModuleBE_PermissionsAssert.assertUserPermissions(projectId, 'v1/stam', {});
			}
		},
		result: true
	},
];

export const TestSuite_Permissions_BasicSetup: BasicProjectTest = {

	label: 'Basic Permissions Setup',
	testcases: TestCases_Basic,
	processor: async (testCase) => {
		// todo validate domain names and accesslevels in apis with definition in the setup

		// create all projects
		// create all domains
		// create all access levels
		// create APIs with the associated access levels
		// let defaultAccountId: string | undefined = undefined;
		// await new MemStorage().init(async () => {
		// 	try {
		// 		defaultAccountId = (await ModuleBE_v2_AccountDB.account.register({
		// 			email: Default_TestEmail,
		// 			password: Default_TestPassword,
		// 			password_check: Default_TestPassword
		// 		}))._id;
		// 	} catch (e) {
		// 		defaultAccountId = (await ModuleBE_v2_AccountDB.query.uniqueWhere({email: Default_TestEmail}))._id;
		// 	}
		// });


		const setup = testCase.input.setup;
		try {
			await new MemStorage().init(async () => {
				// MemKey_AccountEmail.set(Default_TestEmail);
				MemKey_AccountId.set('00000000000000000000000000000000');
				// MemKey_AccountId.set(defaultAccountId!);

				const domainNameToDbObjectMap: TypedMap<DB_PermissionDomain> = {};
				const domainsByName: TypedMap<TypedMap<DB_PermissionAccessLevel>> = {};

				// Create All Projects
				await Promise.all(setup.projects.map(project => ModuleBE_PermissionProject.create.item({
					name: project.name,
					_auditorId: MemKey_AccountId.get()
				})));

				await Promise.all(setup.projects.map(async project => {

					const dbProject = await ModuleBE_PermissionProject.query.uniqueWhere({name: project.name});
					await Promise.all(project.domains.map(async domain => {
						if (domainsByName[domain.namespace])
							throw new BadImplementationException(`Same domain ${domain.namespace} was defined twice`);

						// Create Domain
						const dbDomain = await ModuleBE_PermissionDomain.create.item({
							namespace: domain.namespace,
							projectId: dbProject._id,
							_auditorId: MemKey_AccountId.get()
						});

						// Create AccessLevels
						const levelsToUpsert = domain.levels.map(levelName => ({
							...levelName,
							domainId: dbDomain._id,
							_auditorId: MemKey_AccountId.get()
						}));
						const dbAccessLevels = await ModuleBE_PermissionAccessLevel.create.all(levelsToUpsert);

						// Create AccessLevel ID to DbObject map
						const accessLevelNameToObjectMap = reduceToMap(dbAccessLevels, accessLevel => accessLevel.name, accessLevel => accessLevel);

						// Create Groups
						await ModuleBE_PermissionGroup.create.all(Groups_ToCreate.map(preGroup => ({
							label: preGroup.label,
							accessLevelIds: preGroup.accessLevelIds!.map(levelName => accessLevelNameToObjectMap[levelName]._id)
						})) as PreDB<DB_PermissionGroup>[]);


						domainNameToDbObjectMap[dbDomain.namespace] = dbDomain;
						domainsByName[domain.namespace] = accessLevelNameToObjectMap;
						project.apis.map(async api => {
							const toCreate = {
								projectId: dbProject._id,
								path: api.path,
								accessLevelIds: api.levelNames.map(levelName => domainsByName[api.domain][levelName]._id),
								_auditorId: MemKey_AccountId.get()
							};
							await ModuleBE_PermissionApi.create.item(toCreate);
						});
					}));


				}));
			});
		} catch (e: any) {
			console.error('Test failed because:');
			console.error(e);
			console.error('\n');
		}
		// const userAccessLevels = reduceToMap(testCase.input.userLevels, userLevel => domains[userLevel.domain]._id, userLevel => domainsByName[userLevel.domain][userLevel.levelName].value);
		// MemKey_UserPermissions.set(userAccessLevels);
		//
		// await testCase.input.check();

		// Post Test Cleanup
		await ModuleBE_PermissionProject.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
		await ModuleBE_PermissionDomain.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
		await ModuleBE_PermissionApi.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
		await ModuleBE_PermissionAccessLevel.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
		await ModuleBE_PermissionGroup.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
		await ModuleBE_PermissionUserDB.delete.yes.iam.sure.iwant.todelete.the.collection.delete();
	}
};

describe('Permissions - Basic Setup', () => {
	testSuiteTester(TestSuite_Permissions_BasicSetup);
});