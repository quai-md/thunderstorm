import {ComponentSync} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../types';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';

type DropZone_Props_Base<C extends DragContext> = {
	contextKey: C['key'];
	contextIdentifier: string | number;
	onItemAdded: (item: C['item']) => void;
}

type DropZone_State_Base = {
	contextIdentifier: string | number;
};

export abstract class DropZone_Base<C extends DragContext = DragContext, P = {}, S = {}>
	extends ComponentSync<P & DropZone_Props_Base<C>, S & DropZone_State_Base> {

	//######################### Life Cycle #########################

	constructor(props: P & DropZone_Props_Base<C>) {
		super(props);
		this.contextKey = props.contextKey;
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		state.contextIdentifier = nextProps.contextIdentifier;
		return state;
	}

	componentDidMount() {
		this.subscribeDropZone();
	}

	componentWillUnmount() {
		this.unsubscribeDropZone();
	}

	//######################### Logic #########################

	public onItemAdded = (item: C['item']) => {
		return this.props.onItemAdded(item);
	};

	//######################### Context Logic #########################

	private readonly contextKey: C['key'];

	public getContextKey = () => this.contextKey;

	public getContextIdentifier = () => this.state.contextIdentifier;

	//######################### Abstract #########################

	protected abstract subscribeDropZone(): void;

	protected abstract unsubscribeDropZone(): void;

	public abstract setActive(active: boolean): void;

	public abstract setInitialReceiver(): void;
}