import {ModuleBE_ShortUrlDB} from './ModuleBE_ShortUrlDB';
import {createApisForDBModuleV3} from '@nu-art/thunderstorm/backend';
import {Module_ShortUrlResolver} from '../../../backend/function-module/Module_ShortUrlResolver';
import {Module} from '@nu-art/ts-common';


export const ModulePackBE_ShortUrlDB:Module[] = [ModuleBE_ShortUrlDB, Module_ShortUrlResolver, createApisForDBModuleV3(ModuleBE_ShortUrlDB)];