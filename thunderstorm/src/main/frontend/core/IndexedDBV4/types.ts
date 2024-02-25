import {DBIndex, DBProto} from '@nu-art/ts-common';

export type ReduceFunction_V3<ItemType, ReturnType> = (
	accumulator: ReturnType,
	arrayItem: ItemType,
	index?: number,
	array?: ItemType[]
) => ReturnType

export type DBConfigV3<Proto extends DBProto<any>> = {
	name: string
	group: string;
	version?: number
	autoIncrement?: boolean,
	uniqueKeys: (keyof Proto['dbType'])[]
	indices?: DBIndex<Proto['dbType']>[]
	upgradeProcessor?: (db: IDBDatabase) => void
};

export type IndexDb_Query_V3 = {
	query?: string | number | string[] | number[],
	indexKey?: string,
	limit?: number
};

export enum IndexedDB_Database_Status {
	Closed,
	Opening,
	Opened
}