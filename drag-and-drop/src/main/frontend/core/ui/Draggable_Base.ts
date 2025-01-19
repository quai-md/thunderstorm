import {ComponentSync} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../types';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';
import {Const_DragBrand} from '../../web/modules/consts';

type Draggable_Props_Base<C extends DragContext> = {
	contextKey: C['key'];
	contextIdentifier: string | number;
	item: C['item'];
}

type Draggable_State_Base = {
	contextIdentifier: string | number;
};

export abstract class Draggable_Base<C extends DragContext = DragContext, P = {}, S = {}>
	extends ComponentSync<P & Draggable_Props_Base<C>, S & Draggable_State_Base> {

	static readonly dragBrand = Const_DragBrand;

	//######################### Life Cycle #########################

	constructor(props: P & Draggable_Props_Base<C>) {
		super(props);
		this.contextKey = props.contextKey;
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		state.contextIdentifier = nextProps.contextIdentifier;
		return state;
	}

	//######################### Logic #########################

	public getItem = () => this.props.item;

	//######################### Context Logic #########################

	private readonly contextKey: C['key'];

	public getContextKey = () => this.contextKey;

	public getContextIdentifier = () => this.state.contextIdentifier;
}