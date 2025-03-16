import {Const_UniqueKeys, Day, DBDef_V3, DBProto, Hour, ArrayFilter, RuntimeModules, arrayToMap} from '@nu-art/ts-common';
import {ModuleBE_BaseDB} from '../modules/db-api-gen/ModuleBE_BaseDB';
import {DBModuleFilter} from '../../shared';


export type DBApiBEConfig<Proto extends DBProto<any>> = {
	uniqueKeys: Proto['uniqueKeys']
	itemName: string;
	versions: Proto['versions'];
	TTL: number;
	lastUpdatedTTL: number;
	lockKeys?: Proto['lockKeys']
}

export const getModuleBEConfig = <Proto extends DBProto<any, any, any>>(dbDef: DBDef_V3<Proto>): DBApiBEConfig<Proto> => {
	return {
		versions: dbDef.versions,
		lockKeys: dbDef.lockKeys,
		uniqueKeys: dbDef.uniqueKeys || Const_UniqueKeys as Proto['uniqueKeys'],
		itemName: dbDef.entityName,
		TTL: dbDef.TTL || Hour * 2,
		lastUpdatedTTL: dbDef.lastUpdatedTTL || Day,
	};
};

export const RuntimeBE_ModulesDB = <T extends ModuleBE_BaseDB<any>>(filter: ArrayFilter<T> = DBModuleFilter) =>
	RuntimeModules<T>(filter);

export const RuntimeBE_ModulesDB_Map = () => arrayToMap(RuntimeBE_ModulesDB(), module => module.dbDef.dbKey);


