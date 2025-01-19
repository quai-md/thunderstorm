import * as React from 'react';
import {DragContext} from '../../core';
import {Draggable_Base} from '../../core/ui/Draggable_Base';
import {_className, stopPropagation} from '@nu-art/thunderstorm/frontend';
import {ModuleFE_DragAndDrop_Web} from '../modules/ModuleFE_DragAndDrop_Web';
import './Draggable_Web.scss';
import {Const_DNDContextKey} from '../modules/consts';

type Props = React.PropsWithChildren<React.HTMLProps<HTMLDivElement>>

export class Draggable_Web<C extends DragContext>
	extends Draggable_Base<C, Props> {

	//The offset between the top-left corner of the element and the grab origin
	private dragOffset: { x: number; y: number } = {x: 0, y: 0};
	private draggableRef: React.RefObject<HTMLDivElement> = React.createRef();

	//######################### Logic #########################

	private getProps = (): React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {contextKey, contextIdentifier, item, ...props} = this.props;
		return {
			...props,
			ref: this.draggableRef,
			className: _className('ts-dnd__draggable', props.className),
			onMouseDown: this.onDragStart,
		};
	};

	private getDataAttributes = () => {
		return {
			[Const_DNDContextKey]: this.getContextKey(),
		};
	};

	private getElement = () => {
		const element = this.draggableRef.current;
		if (!element)
			this.logError('Could not get element!');

		return element;
	};

	private onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
		stopPropagation(e);
		const element = this.getElement();
		if (!element)
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
		window.addEventListener('mousemove', this.onDragMove);
		window.addEventListener('mouseup', this.onDragEnd);
		ModuleFE_DragAndDrop_Web.dragEvent.start(this);
	};

	public onDragMove = (e: MouseEvent) => {
		const element = this.getElement();
		if (!element)
			return;

		const newX = e.x - this.dragOffset.x;
		const newY = e.y - this.dragOffset.y;
		element.style.left = `${newX}px`;
		element.style.top = `${newY}px`;
	};

	private onDragEnd = (e: MouseEvent) => {
		const element = this.getElement();
		if (!element)
			return;

		window.removeEventListener('mousemove', this.onDragMove);
		window.removeEventListener('mouseup', this.onDragEnd);
		element.style.removeProperty('position');
		element.style.removeProperty('width');
		element.style.removeProperty('height');
		element.style.removeProperty('top');
		element.style.removeProperty('left');
		element.style.removeProperty('pointer-events');
		document.body.classList.remove('ts-dragging');
		ModuleFE_DragAndDrop_Web.dragEvent.end();
	};

	//######################### Render #########################

	render() {
		return <div
			{...this.getProps()}
			{...this.getDataAttributes()}
		/>;
	}
}