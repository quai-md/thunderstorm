import * as React from 'react';
import {BadImplementationException, TS_Object} from '@nu-art/ts-common';
import {DragZone} from '../../../../core/DragZone';
import {DragEventRect} from '../../../../core';
import {isDragItem} from '../../../../core/consts';

export class DragZone_Web<T extends TS_Object>
	extends DragZone<T, HTMLDivElement> {

	public getRect(): DragEventRect {
		const rect = this.ref.current?.getBoundingClientRect();
		if (!rect)
			throw new BadImplementationException('Could not get bounding client rect for drag zone!');

		const {width, height, x, y} = rect;
		return {width, height, x, y};
	}

	private getElementProperties = (): React.HTMLProps<HTMLDivElement> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {context, processor, children, ...props} = this.props;
		const _children = React.Children.toArray(children);
		//Verify all children are drag items
		_children.forEach(child => {
			if (!React.isValidElement(child) || !isDragItem(child))
				throw new BadImplementationException('Component DragZone_Web only accepts components expanding on DragItem as valid children');
		});
		return {
			...props,
			children,
			ref: this.ref,
			className: 'ts-dnd__drag-zone',
		};
	};

	render() {
		return <div
			{...this.getElementProperties()}
		/>;
	}
}