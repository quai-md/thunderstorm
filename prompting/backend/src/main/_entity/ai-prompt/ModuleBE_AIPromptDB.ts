import {DBDef_AIPrompt, DBProto_AIPrompt} from '@nu-art/prompting-shared';
import {DBApiConfigV3, ModuleBE_BaseDB} from '@nu-art/thunderstorm-backend';

type Config = DBApiConfigV3<DBProto_AIPrompt> & {}

export class ModuleBE_AIPromptDB_Class
	extends ModuleBE_BaseDB<DBProto_AIPrompt, Config> {

	constructor() {
		super(DBDef_AIPrompt);
	}
}

export const ModuleBE_AIPromptDB = new ModuleBE_AIPromptDB_Class();
