import {ComponentSync} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../types';

export type DraggableProps<C extends DragContext> = {
	contextKey: C['key'];
	contextIdentifier: string | number;
}

export abstract class Draggable_Base<C extends DragContext = DragContext, P extends DraggableProps<C> = DraggableProps<C>, S = any>
	extends ComponentSync<P, S> {

	//######################### Life Cycle #########################

	constructor(props: P) {
		super(props);
		this.contextKey = props.contextKey;
	}

	//######################### Context Key Logic #########################

	private readonly contextKey: C['key'];

	public getContextKey = () => this.contextKey;
}