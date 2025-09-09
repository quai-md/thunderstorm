import {Logger, removeItemFromArray, TS_Object} from '@nu-art/ts-common';
import {DragContextDataListenerComponent, DragEvent, DragEventRect} from './types';
import {DragZone} from './DragZone';
import {EditableItem} from '@nu-art/thunderstorm/frontend';
import {DragItem} from './DragItem';
import * as React from 'react';

export class DragContext<T extends TS_Object = TS_Object>
	extends Logger {

	//######################### Properties #########################

	// @ts-ignore
	private readonly key: string;
	private dragEvent?: DragEvent<T>;
	private readonly dropZones: DragZone<T>[] = [];
	private dataListeners: DragContextDataListenerComponent[] = [];

	//######################### Life Cycle #########################

	constructor(contextKey: string) {
		const tag = `DragContext__${contextKey}`;
		super(tag);
		this.key = contextKey;
	}

	//######################### Internal Logic #########################

	private getIntersectingDragZone = (draggable: DragItem<T>): DragZone<T> | undefined => {
		const {x, y, width, height} = draggable.getRect();
		const center = {x: x + width / 2, y: y + height / 2};

		return this.dropZones.find(zone => {
			const zoneRect = zone.getRect();
			return (
				center.x >= zoneRect.x &&
				center.x <= zoneRect.x + zoneRect.width &&
				center.y >= zoneRect.y &&
				center.y <= zoneRect.y + zoneRect.height
			);
		});
	};

	/**
	 * Returns the index of the best-overlapping item within the zone.
	 * - If `skipSelf` is true, the `draggable` instance is ignored in scoring (useful while dragging).
	 * - If no item overlaps beyond `threshold`, returns `children.length` (append).
	 */
	private getIntersectingDragItem = (zone: DragZone<T>, draggable: DragItem<T>, threshold: number = 0.2, skipSelf: boolean = false): number => {
		let bestIndex = -1;
		let bestScore = 0;
		const draggableRect = draggable.getRect();
		const areaA = draggableRect.width * draggableRect.height;

		const children = React.Children.toArray(zone.props.children) as React.ReactElement[];
		for (let i = 0; i < children.length; i++) {
			const childEl = children[i] as unknown as DragItem<T>;
			const ref = (childEl as any)?.innerRef as React.RefObject<any> | undefined;
			const instance = ref?.current as DragItem<T> | undefined;
			if (!instance) continue;
			if (skipSelf && instance === draggable) continue; // self-skip when requested

			const rect = instance.getRect();
			const overlap = this.getOverlapRect(draggableRect, rect);
			if (!overlap) continue;

			const overlapArea = overlap.width * overlap.height;
			const score = overlapArea / areaA;
			if (score > threshold && score > bestScore) {
				bestScore = score;
				bestIndex = i;
			}
		}

		return bestIndex !== -1 ? bestIndex : children.length;
	};

	private getOverlapRect = (a: DragEventRect, b: DragEventRect): DragEventRect | null => {
		const x1 = Math.max(a.x, b.x);
		const y1 = Math.max(a.y, b.y);
		const x2 = Math.min(a.x + a.width, b.x + b.width);
		const y2 = Math.min(a.y + a.height, b.y + b.height);

		if (x2 <= x1 || y2 <= y1) return null;
		return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
	};

	private updateListeners = () => {
		if (!this.dataListeners.length)
			return;

		this.dataListeners.forEach(listener => listener.__onDragContextUpdated());
	};

	//######################### Public Logic #########################

	public event = {
		start: (draggable: DragItem<T>, editable: EditableItem<T>) => {
			this.logDebug('Drag started');
			const originZone = this.getIntersectingDragZone(draggable);
			if (!originZone)
				throw new Error('Cannot start drag: no intersecting drop zone found');

			const originIndex = this.getIntersectingDragItem(originZone, draggable, 0.2, false);

			this.dragEvent = {
				draggable,
				editable,
				origin: {zone: originZone, index: originIndex},
				target: {zone: originZone, index: originIndex},
			};
			this.updateListeners();
		},
		updateTarget: () => {
			if (!this.dragEvent)
				return;

			const zone = this.getIntersectingDragZone(this.dragEvent.draggable);
			if (!zone)
				return;

			const index = this.getIntersectingDragItem(zone, this.dragEvent.draggable, 0.2, true);
			this.dragEvent.target = {zone, index};
			this.logDebug(`Drag target updated: zone=${zone.getId()} index=${index}`);
			this.updateListeners();
		},
		end: async () => {
			if (!this.dragEvent)
				return;

			const {target} = this.dragEvent;
			await target.zone.onDrop(this.dragEvent);
			this.dragEvent = undefined;
			this.logDebug('Drag ended');
			this.updateListeners();
		}
	};

	public zone = {
		register: (zone: DragZone<T>) => {
			this.logDebug(`Registering zone: ${zone.getId()}`);
			this.dropZones.push(zone);
		},
		unregister: (zone: DragZone<T>) => {
			this.logDebug(`Unregistering zone: ${zone.getId()}`);
			const index = this.dropZones.indexOf(zone);
			if (index !== -1)
				this.dropZones.splice(index, 1);
		}
	};

	//######################### Data Listeners #########################

	public dataListener = {
		register: (listener: DragContextDataListenerComponent) => {
			if (this.dataListeners.includes(listener))
				return;

			this.dataListeners.push(listener);
		},
		unregister: (listener: DragContextDataListenerComponent) => {
			removeItemFromArray(this.dataListeners, listener);
		},
		getCurrentEvent: () => this.dragEvent,
	};
}

