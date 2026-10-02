import {createApisForDBModuleV3} from '@nu-art/thunderstorm-backend';
import {ModuleBE_AIPromptDB} from './ModuleBE_AIPromptDB.js';

export const ModulePackBE_AIPrompt = [ModuleBE_AIPromptDB, createApisForDBModuleV3(ModuleBE_AIPromptDB)];
