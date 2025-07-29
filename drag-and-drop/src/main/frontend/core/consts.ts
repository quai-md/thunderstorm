import {TS_Object} from '@nu-art/ts-common';
import {DragItem} from './DragItem';

export const Brand_DragItem = '__drag-item';

export interface DragItemBrand {
	readonly __brand: typeof Brand_DragItem;
}

export const isDragItem = <T extends TS_Object>(value: unknown): value is DragItem<T> => {
	return typeof value === 'object' && value !== null && '__brand' in value && value.__brand === Brand_DragItem;
};