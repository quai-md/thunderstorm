import {TS_Object} from '@nu-art/ts-common';
import {EditableItem} from '@nu-art/thunderstorm/frontend';
import {DragItem} from './DragItem';
import {DragZone} from './DragZone';

export type DragEvent<T extends TS_Object> = {
	draggable: DragItem<T>;
	editable: EditableItem<T>;
	origin: {
		zone: DragZone<T>;
		index: number;
	}
	target: {
		zone: DragZone<T>;
		index: number;
	}
}

export type DragEventRect = {
	x: number;
	y: number;
	width: number;
	height: number;
}