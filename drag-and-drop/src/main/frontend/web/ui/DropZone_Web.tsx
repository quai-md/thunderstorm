import * as React from 'react';
import {ModuleFE_DragAndDrop_Web} from '../modules/ModuleFE_DragAndDrop_Web';
import {DragContext} from '../../core';
import {_className} from '@nu-art/thunderstorm/frontend';
import {DropZone_Base} from '../../core/ui/DropZone_Base';
import {Const_DNDContextKey, Const_DNDDZActive, Const_DNDDZReceiver, Const_DragBrand} from '../modules/consts';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';
import {BadImplementationException} from '@nu-art/ts-common';
import {Draggable_Web} from './Draggable_Web';

type Props = React.HTMLProps<HTMLDivElement> & { children: React.ReactElement[] };

export class DropZone_Web<C extends DragContext>
	extends DropZone_Base<C, Props> {

	private dzRef: React.RefObject<HTMLDivElement> = React.createRef();

	//######################### Life Cycle #########################

	shouldComponentUpdate(nextProps: InferProps<DropZone_Base<C>> & Props, nextState: InferState<DropZone_Base<C>>, nextContext: any) {
		//Component should re-render if the amount of children it has changed
		return super.shouldComponentUpdate(nextProps, nextState, nextContext) || this.props.children.length !== nextProps.children.length;
	}

	//######################### Abstract Implementation #########################

	protected subscribeDropZone(): void {
		ModuleFE_DragAndDrop_Web.dropZoneActions.subscribe(this);
	}

	protected unsubscribeDropZone(): void {
		ModuleFE_DragAndDrop_Web.dropZoneActions.unsubscribe(this);
	}

	public setActive(active: boolean): void {
		const element = this.getElement();
		if (!element)
			return;

		if (active) {
			element.setAttribute(Const_DNDDZActive, 'true');
			element.addEventListener('mouseenter', this.onMouseEnter);
			element.addEventListener('mouseleave', this.onMouseLeave);
		} else {
			element.removeAttribute(Const_DNDDZActive);
			element.removeAttribute(Const_DNDDZReceiver);
			element.removeEventListener('mouseenter', this.onMouseEnter);
			element.removeEventListener('mouseleave', this.onMouseLeave);
		}
	}

	public setInitialReceiver() {
		const element = this.getElement();
		if (!element)
			return;

		element.setAttribute(Const_DNDDZReceiver, 'true');
	}

	//######################### Logic #########################

	private getProps = (): Partial<InferProps<DropZone_Web<any>>> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {contextKey, contextIdentifier, onItemAdded, ...props} = this.props;
		//Validate children
		props.children.forEach(child => {
			if (!React.isValidElement(child))
				throw new BadImplementationException('Component DropZone_Web only accepts ReactElement as a valid child');

			const proto = child.type as typeof Draggable_Web;
			if (proto.dragBrand !== Const_DragBrand)
				throw new BadImplementationException('Component DropZone_Web only accepts components expanding on Draggable_Base as valid children');
		});
		return {
			...props,
			ref: this.dzRef,
			className: _className('ts-dnd__dropzone', props.className),
		};
	};

	private getDataAttributes = () => {
		return {
			[Const_DNDContextKey]: this.getContextKey(),
		};
	};

	private getElement = () => {
		const element = this.dzRef.current;
		if (!element)
			this.logError('Could not get element!');

		return element;
	};

	private onMouseEnter = () => {
		const element = this.getElement();
		if (!element)
			return;

		element.setAttribute(Const_DNDDZReceiver, 'true');
		ModuleFE_DragAndDrop_Web.dragEvent.setReceiver(this);
	};

	private onMouseLeave = () => {
		const element = this.getElement();
		if (!element)
			return;

		element.removeAttribute(Const_DNDDZReceiver);
		ModuleFE_DragAndDrop_Web.dragEvent.clearReceiver();
	};

	//######################### Render #########################

	render() {
		return <div
			{...this.getProps()}
			{...this.getDataAttributes()}
		/>;
	}
}