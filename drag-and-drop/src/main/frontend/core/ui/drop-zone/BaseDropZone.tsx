import {ComponentSync} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../../_shared';

export type DropZoneProps<C extends DragContext> = { contextKey: C['key'] }

export abstract class BaseDropZone<C extends DragContext = DragContext, P extends DropZoneProps<C> = DropZoneProps<C>, S = any>
	extends ComponentSync<P, S> {

	//######################### Life Cycle #########################

	constructor(props: P) {
		super(props);
		this.contextKey = props.contextKey;
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

}