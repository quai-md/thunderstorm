import {createApisForDBModuleV3} from '@nu-art/thunderstorm-backend';
import {ModuleBE_OverlayDB} from './ModuleBE_OverlayDB.js';

export const ModulePackBE_Overlay = [ModuleBE_OverlayDB, createApisForDBModuleV3(ModuleBE_OverlayDB)];
