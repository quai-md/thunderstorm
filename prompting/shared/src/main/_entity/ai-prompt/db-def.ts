import {DBDef_V3, tsValidateString} from '@nu-art/ts-common';
import {DBProto_AIPrompt} from './types.js';
import {Validator_AIPromptType} from '../../_enum/ai-prompt-type/index.js';

const Validator_ModifiableProps: DBProto_AIPrompt['modifiablePropsValidator'] = {
	label: tsValidateString(),
	content: tsValidateString(),
	type: Validator_AIPromptType,
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
