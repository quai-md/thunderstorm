import {Module} from '@nu-art/ts-common';
import {DropZone_Base} from '../ui/DropZone_Base';
import {Draggable_Base} from '../ui/Draggable_Base';

type DragEvent = {
	draggable: Draggable_Base;
	contextKey: string;
	dropZones: DropZone_Base[];
	receiverDropZone?: DropZone_Base;
}

export abstract class ModuleFE_DragAndDrop_Base
	extends Module {

	//######################### Drop Zone Logic #########################

	private dropZones: { [K: string]: DropZone_Base<any, any>[] } = {};

	public dropZoneActions = {
		subscribe: <DZ extends DropZone_Base>(dropZone: DZ) => {
			const contextKey = dropZone.getContextKey();
			this.dropZones[contextKey] ??= [];
			this.dropZones[contextKey].push(dropZone);
		},
		unsubscribe: <DZ extends DropZone_Base>(dropZone: DZ) => {
			const contextKey = dropZone.getContextKey();
			this.dropZones[contextKey] = this.dropZones[contextKey].filter(dz => dz !== dropZone);
			if (!this.dropZones[contextKey].length)
				delete this.dropZones[contextKey];
		},
	};

	//######################### Drag Event Logic #########################

	private _dragEvent?: DragEvent;

	public dragEvent = {
		start: <D extends Draggable_Base>(draggable: D) => {
			if (this._dragEvent)
				return this.logErrorBold('Can\'t start a new drag event while another drag event is in progress');

			const contextKey = draggable?.getContextKey();
			const dropZones = this.dropZones[contextKey];
			//Find starting drop zone

			//Set a new drag event object
			this._dragEvent = {
				draggable,
				contextKey,
				dropZones,
			};

			//Set active state for all drop zones in this event context
			this._dragEvent?.dropZones.forEach(dropZone => {
				dropZone.setActive(true);
			});
		},
		end: () => {
			//Unset active for all the drop zones in this event context
			this._dragEvent?.dropZones.forEach(dropZone => {
				dropZone.setActive(false);
			});

			//Delete the event
			delete this._dragEvent;
		},
		setReceiver: <DZ extends DropZone_Base>(dropZone: DZ) => {
			if (!this._dragEvent)
				return this.logError('Trying to set a receiver drop zone outside of a drag event');

			if (!this._dragEvent.dropZones.includes(dropZone))
				return this.logError('Trying to set a receiver drop zone out of context of the drag event');

			this._dragEvent.receiverDropZone = dropZone;
		},
		clearReceiver: () => {
			if (!this._dragEvent)
				return;

			delete this._dragEvent.receiverDropZone;
		}
	};
}