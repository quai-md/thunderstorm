import * as React from 'react';
import {DragContext} from '../_shared';
import {BaseDropZone, DropZoneProps} from '../../core/ui/drop-zone/BaseDropZone';
import { ModuleFE_DragAndDrop_Web } from '../modules/ModuleFE_DragAndDrop_Web';

type WebDropZoneProps<C extends DragContext> = React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> & DropZoneProps<C>

export class WebDropZone<C extends DragContext, P extends WebDropZoneProps<C> = WebDropZoneProps<C>, S = any>
	extends BaseDropZone<C, P, S> {

	//######################### Life Cycle #########################

	//######################### Abstract Implementation #########################

	protected subscribeDropZone(): void {
		ModuleFE_DragAndDrop_Web.dropZoneActions.subscribe(this);
	}

	protected unsubscribeDropZone(): void {
		ModuleFE_DragAndDrop_Web.dropZoneActions.unsubscribe(this);
	}

	//######################### Logic #########################

	private getProps = (): React.PropsWithChildren<React.HTMLProps<HTMLDivElement>> => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {contextKey, ...props} = this.props;
		return {
			...props,
			'data-dz-context-key': this.getContextKey(),
		};
	};

	//######################### Render #########################

	render() {
		return <div {...this.getProps()}/>;
	}
}