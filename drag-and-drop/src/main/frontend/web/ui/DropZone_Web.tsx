import * as React from 'react';
import {ModuleFE_DragAndDrop_Web} from '../modules/ModuleFE_DragAndDrop_Web';
import {DragContext} from '../../core';
import {_className} from '@nu-art/thunderstorm/frontend';
import {DropZoneProps, DropZone_Base} from '../../core/ui/DropZone_Base';

type WebDropZoneProps<C extends DragContext> = React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> & DropZoneProps<C>

export class DropZone_Web<C extends DragContext, P extends WebDropZoneProps<C> = WebDropZoneProps<C>, S = any>
	extends DropZone_Base<C, P, S> {

	private dzRef: React.RefObject<HTMLDivElement> = React.createRef();

	//######################### Life Cycle #########################

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
			element.setAttribute('data-dz-active', 'true');
			element.addEventListener('mouseenter', this.onMouseEnter);
			element.addEventListener('mouseleave', this.onMouseLeave);
		} else {
			element.removeAttribute('data-dz-active');
			element.removeAttribute('data-dz-receiver');
			element.removeEventListener('mouseenter', this.onMouseEnter);
			element.removeEventListener('mouseleave', this.onMouseLeave);
		}
	}

	//######################### Logic #########################

	private getProps = (): React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {contextKey, ...props} = this.props;
		return {
			...props,
			ref: this.dzRef,
			className: _className('ts-dnd__dropzone', props.className),
			'data-dz-context-key': this.getContextKey(),
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

		element.setAttribute('data-dz-receiver', 'true');
		ModuleFE_DragAndDrop_Web.dragEvent.setReceiver(this);
	};

	private onMouseLeave = () => {
		const element = this.getElement();
		if (!element)
			return;

		element.removeAttribute('data-dz-receiver');
		ModuleFE_DragAndDrop_Web.dragEvent.clearReceiver();
	};

	//######################### Render #########################

	render() {
		return <div {...this.getProps()}/>;
	}
}