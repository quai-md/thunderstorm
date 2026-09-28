import {DBDef_V3, tsValidateString, tsValidateValue} from '@nu-art/ts-common';
import {AIPromptTypes} from './consts.js';
import {DBProto_AIPrompt} from './types.js';

const Validator_ModifiableProps: DBProto_AIPrompt['modifiablePropsValidator'] = {
	label: tsValidateString(),
	content: tsValidateString(),
	type: tsValidateValue(AIPromptTypes),
};

const Validator_GeneratedProps: DBProto_AIPrompt['generatedPropsValidator'] = {};

export const DBDef_AIPrompt: DBDef_V3<DBProto_AIPrompt> = {
	modifiablePropsValidator: Validator_ModifiableProps,
	generatedPropsValidator: Validator_GeneratedProps,
	versions: ['1.0.0'],
	dbKey: 'ai-prompt',
	entityName: 'ai-prompt',
	frontend: {
		group: 'app',
		name: 'ai-prompt',
	},
	backend: {
		name: 'ai-prompt',
	},
};
