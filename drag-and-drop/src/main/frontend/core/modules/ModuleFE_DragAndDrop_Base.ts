import {Module} from '@nu-art/ts-common';
import {BaseDropZone} from '../ui/drop-zone/BaseDropZone';

export abstract class ModuleFE_DragAndDrop_Base
	extends Module {

	//######################### Drop Zone Logic #########################

	private dropZones: { [K: string]: BaseDropZone<any, any>[] } = {};

	public dropZoneActions = {
		subscribe: <DZ extends BaseDropZone>(dropZone: DZ) => {
			const contextKey = dropZone.getContextKey();
			this.dropZones[contextKey] ??= [];
			this.dropZones[contextKey].push(dropZone);
		},
		unsubscribe: <DZ extends BaseDropZone>(dropZone: DZ) => {
			const contextKey = dropZone.getContextKey();
			this.dropZones[contextKey] = this.dropZones[contextKey].filter(dz => dz !== dropZone);
			if (!this.dropZones[contextKey].length)
				delete this.dropZones[contextKey];
		}
	};

	//######################### Draggable Item Logic #########################

}