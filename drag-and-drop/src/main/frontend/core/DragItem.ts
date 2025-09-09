import {TS_Object} from '@nu-art/ts-common';
import * as React from 'react';
import {DragContext} from './DragContext';
import {EditableItem} from '@nu-art/thunderstorm/frontend';
import {DragEventRect} from './types';
import {Brand_DragItem} from './consts';

export type Props<T extends TS_Object> = React.PropsWithChildren<{
	context: DragContext<T>;
	editable: EditableItem<T>;
}>

export abstract class DragItem<T extends TS_Object, RefType = any>
	extends React.Component<Props<T>> {

	static readonly __brand = Brand_DragItem;

	public innerRef: React.RefObject<RefType> = React.createRef();

	public abstract getRect(): DragEventRect;

	public shouldComponentUpdate(): boolean {
		return true;
	}

	protected startEvent = () => {
		const {context, editable} = this.props;
		context.event.start(this, editable);
	};

	protected updateEvent = () => {
		const {context} = this.props;
		context.event.updateTarget();
	};

	protected endEvent = () => {
		const {context} = this.props;
		context.event.end();
	};
}

