import {ReactElement} from 'react';

export const Brand_DragItem = '__drag-item';

export const isDragItem = (value: ReactElement): boolean => {
	return (value.type as any)?.__brand === Brand_DragItem;
};