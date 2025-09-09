import {UniqueId} from '@nu-art/ts-common';

export const DNDTestItemStatus_Ready = 'ready';
export const DNDTestItemStatus_InProgress = 'in-progress';
export const DNDTestItemStatus_Done = 'done';
export const DNDTestItemStatuses = [DNDTestItemStatus_Ready, DNDTestItemStatus_InProgress, DNDTestItemStatus_Done] as const;
export type DNDTest_Item_Status = typeof DNDTestItemStatuses[number];

export type DNDTest_Item = {
	id: UniqueId;
	label: string;
	status: DNDTest_Item_Status;
}