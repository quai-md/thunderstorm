import * as React from 'react';
import {BadImplementationException, ThisShouldNotHappenException, TS_Object} from '@nu-art/ts-common';
import {DragItem} from '../../../../core/DragItem';
import {DragEventRect} from '../../../../core';

export class DragItem_Web<T extends TS_Object>
	extends DragItem<T, HTMLDivElement> {

	private offsetX = 0;
	private offsetY = 0;

	//######################### Abstract Implementation #########################

	public getRect(): DragEventRect {
		const rect = this.innerRef.current?.getBoundingClientRect();
		if (!rect)
			throw new BadImplementationException('Could not get bounding client rect for drag item!');

		const {width, height, x, y} = rect;
		return {width, height, x, y};
	}

	//######################### Logic #########################

	private getElementProperties = (): React.HTMLProps<HTMLDivElement> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {editable, context, ...props} = this.props;
		return {
			...props,
			ref: this.innerRef,
			className: 'ts-dnd__drag-item',
			onMouseDown: this.onMouseDown,
		};
	};

	private onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		const {context, editable} = this.props;
		context.event.start(this, editable);
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mouseup', this.onMouseUp);

		//Assign new item style
		const element = this.innerRef.current;
		if (!element)
			throw new ThisShouldNotHappenException('How did we start an event without the element???');

		const rect = element.getBoundingClientRect();
		this.offsetX = e.clientX - rect.left;
		this.offsetY = e.clientY - rect.top;

		element.style.position = 'fixed';
		element.style.left = `${e.clientX - this.offsetX}px`;
		element.style.top = `${e.clientY - this.offsetY}px`;
		element.style.width = `${rect.width}px`;
		element.style.height = `${rect.height}px`;
	};

	private onMouseMove = (e: MouseEvent) => {
		const {context} = this.props;
		context.event.updateTarget();
		//Assign new item style
		const element = this.innerRef.current;
		if (!element)
			throw new ThisShouldNotHappenException('How did we update an event without the element???');

		element.style.left = `${e.clientX - this.offsetX}px`;
		element.style.top = `${e.clientY - this.offsetY}px`;
	};

	private onMouseUp = async () => {
		const {context} = this.props;
		await context.event.end();
		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mouseup', this.onMouseUp);

		const element = this.innerRef.current;
		this.offsetX = 0;
		this.offsetY = 0;
		if (element) {
			//If the element exists we did not unmount it,
			// so it is still in the same spot it started in and therefore should lose all the style attributes
			element.removeAttribute('style');
		}
	};

	//######################### Render #########################

	render() {
		return <div
			{...this.getElementProperties()}
		/>;
	}
}