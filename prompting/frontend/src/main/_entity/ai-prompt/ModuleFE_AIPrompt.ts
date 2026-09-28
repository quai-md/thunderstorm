import {ApiStruct_AIPrompt, DBDef_AIPrompt, DBProto_AIPrompt} from '@nu-art/prompting-shared';
import {DispatcherDef, ThunderDispatcherV3} from '@nu-art/thunderstorm-frontend/core/db-api-gen/types';
import {ModuleFE_BaseApi} from '@nu-art/thunderstorm-frontend/index';
import {ApiDefCaller} from '@nu-art/thunderstorm-shared';

export type DispatcherType_AIPrompt = DispatcherDef<DBProto_AIPrompt, `__onAIPromptsUpdated`>;

export const dispatch_onAIPromptsUpdated = new ThunderDispatcherV3<DispatcherType_AIPrompt>('__onAIPromptsUpdated');

export class ModuleFE_AIPrompt_Class
	extends ModuleFE_BaseApi<DBProto_AIPrompt>
	implements ApiDefCaller<ApiStruct_AIPrompt> {

	_v1: ApiDefCaller<ApiStruct_AIPrompt>['_v1'];

	constructor() {
		super(DBDef_AIPrompt, dispatch_onAIPromptsUpdated);
		this._v1 = {};
	}
}

export const ModuleFE_AIPrompt = new ModuleFE_AIPrompt_Class();
