import {ComponentSync} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../types';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';

export type DropZoneProps<C extends DragContext> = {
	contextKey: C['key'];
	contextIdentifier: string | number;
}

export abstract class DropZone_Base<C extends DragContext = DragContext, P extends DropZoneProps<C> = DropZoneProps<C>, S = any>
	extends ComponentSync<P, S> {

	//######################### Life Cycle #########################

	constructor(props: P) {
		super(props);
		this.contextKey = props.contextKey;
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		return state;
	}

	componentDidMount() {
		this.subscribeDropZone();
	}

	componentWillUnmount() {
		this.unsubscribeDropZone();
	}

	//######################### Context Key Logic #########################

	private readonly contextKey: C['key'];

	public getContextKey = () => this.contextKey;

	//######################### Abstract #########################

	protected abstract subscribeDropZone(): void;

	protected abstract unsubscribeDropZone(): void;

	public abstract setActive(active: boolean): void;
}