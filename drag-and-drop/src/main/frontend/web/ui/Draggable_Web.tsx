import * as React from 'react';
import {DragContext} from '../../core';
import {Draggable_Base} from '../../core/ui/Draggable_Base';
import {_className, stopPropagation} from '@nu-art/thunderstorm/frontend';
import {ModuleFE_DragAndDrop_Web} from '../modules/ModuleFE_DragAndDrop_Web';
import './Draggable_Web.scss';
import {Const_DNDContextKey} from '../modules/consts';
import {ResolvableContent, resolveContent} from '@nu-art/ts-common';

type Props = React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> & {
	dragAnchor?: ResolvableContent<React.ReactNode>;
}

export class Draggable_Web<C extends DragContext>
	extends Draggable_Base<C, Props> {

	//The offset between the top-left corner of the element and the grab origin
	private dragOffset: { x: number; y: number } = {x: 0, y: 0};
	private draggableRef: React.RefObject<HTMLDivElement> = React.createRef();

	//######################### Logic #########################

	private onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		stopPropagation(e);
		const element = this.getElement();
		if (!element)
			return;

		//Assert not blocking a clickable child
		if (!this.assertNotBlockingClickableChild(element, e))
			return;

		const rect = element.getBoundingClientRect();
		element.style.width = `${rect.width}px`;
		element.style.height = `${rect.height}px`;
		element.style.top = `${rect.y}px`;
		element.style.left = `${rect.x}px`;
		element.style.position = 'fixed';
		element.style.pointerEvents = 'none';
		document.body.classList.add('ts-dragging');
		this.dragOffset.x = e.clientX - rect.x;
		this.dragOffset.y = e.clientY - rect.y;
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mouseup', this.onMouseUp);
		ModuleFE_DragAndDrop_Web.dragEvent.start(this);
	};

	private onMouseMove = (e: MouseEvent) => {
		const element = this.getElement();
		if (!element)
			return;

		const newX = e.x - this.dragOffset.x;
		const newY = e.y - this.dragOffset.y;
		element.style.left = `${newX}px`;
		element.style.top = `${newY}px`;
	};

	private onMouseUp = (e: MouseEvent) => {
		const element = this.getElement();
		if (!element)
			return;

		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mouseup', this.onMouseUp);
		element.style.removeProperty('position');
		element.style.removeProperty('width');
		element.style.removeProperty('height');
		element.style.removeProperty('top');
		element.style.removeProperty('left');
		element.style.removeProperty('pointer-events');
		document.body.classList.remove('ts-dragging');
		ModuleFE_DragAndDrop_Web.dragEvent.end();
	};

	//######################### Utils #########################

	private getElement = () => {
		const element = this.draggableRef.current;
		if (!element)
			this.logError('Could not get element!');

		return element;
	};

	private assertNotBlockingClickableChild = (element: HTMLDivElement, event: React.MouseEvent<HTMLDivElement>): boolean => {
		if (event.target === element)
			return true;

		return !(event.target instanceof HTMLButtonElement);
	};

	//######################### Render Utils #########################

	private getProps = (): React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {contextKey, contextIdentifier, item, dragAnchor, ...props} = this.props;
		return {
			...props,
			ref: this.draggableRef,
			className: _className('ts-dnd__draggable', !!dragAnchor && 'with-anchor', props.className),
			onMouseDown: dragAnchor ? undefined : this.onMouseDown,
		};
	};

	private getDataAttributes = () => {
		return {
			[Const_DNDContextKey]: this.getContextKey(),
		};
	};

	//######################### Render #########################

	render() {
		const props = this.getProps();
		return <div
			{...props}
			{...this.getDataAttributes()}
		>
			{this.render_Anchor()}
			{props.children}
		</div>;
	}

	private render_Anchor = () => {
		if (!this.props.dragAnchor)
			return;

		return <div
			onMouseDown={this.onMouseDown}
			className={'ts-dnd__draggable-anchor'}
		>
			{resolveContent(this.props.dragAnchor)}
		</div>;
	};
}