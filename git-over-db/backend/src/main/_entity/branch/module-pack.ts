import {createApisForDBModuleV3} from '@nu-art/thunderstorm-backend';
import {ModuleBE_BranchDB} from './ModuleBE_BranchDB.js';

export const ModulePackBE_Branch = [ModuleBE_BranchDB, createApisForDBModuleV3(ModuleBE_BranchDB)];
