import {DefaultAccessLevel_Read, DefaultAccessLevel_Write, DuplicateDefaultAccessLevels} from '@nu-art/permissions-shared';
import {defaultValueResolver, PermissionKey_BE} from '@nu-art/permissions-backend/PermissionKey_BE';
import {DefaultDef_Package} from '@nu-art/permissions-backend';
import {DomainNamespace_AIPrompt, PermissionKey_AIPromptEdit, PermissionKey_AIPromptView} from '@nu-art/prompting-shared';
import {ModuleBE_AIPromptDB} from './ModuleBE_AIPromptDB.js';

export const Domain_AIPrompt = Object.freeze({
	_id: 'c4e8a1d67b9035f2e1a6c8d04b7f3921',
	namespace: DomainNamespace_AIPrompt,
});

export const PermissionKeyBE_AIPromptView = new PermissionKey_BE(PermissionKey_AIPromptView, () => defaultValueResolver(DomainNamespace_AIPrompt, DefaultAccessLevel_Read.value));
export const PermissionKeyBE_AIPromptEdit = new PermissionKey_BE(PermissionKey_AIPromptEdit, () => defaultValueResolver(DomainNamespace_AIPrompt, DefaultAccessLevel_Write.value));

export const Permissions_AIPrompt: DefaultDef_Package = {
	name: Domain_AIPrompt.namespace,
	domains: [
		{
			...Domain_AIPrompt,
			levels: [...DuplicateDefaultAccessLevels(Domain_AIPrompt._id)],
			dbNames: [
				ModuleBE_AIPromptDB.dbDef
			].map(dbDef => dbDef.dbKey)
		}
	]
};
