import * as React from 'react';
import {ComponentSync, LL_V_L} from '@nu-art/thunderstorm/frontend';
import {DragContext} from '../../../../core/DragContext';
import {DragContextDataListener, DragEvent} from '../../../../core';
import './DragDebugMenu_Web.scss';

type Props = {
	context: DragContext<any>;
};

export class DragDebugMenu_Web
	extends ComponentSync<Props>
	implements DragContextDataListener {

	//######################### Life Cycle #########################

	__onDragContextUpdated = () => {
		this.forceUpdate();
	};

	componentDidMount() {
		this.props.context.dataListener.register(this);
	}

	componentWillUnmount() {
		this.props.context.dataListener.unregister(this);
	}

	//######################### Render #########################

	render() {
		const event = this.props.context.dataListener.getCurrentEvent();
		if (!event)
			return;

		return <LL_V_L className={'ts-dnd__debug-menu'}>
			<h1>DND Debug Menu</h1>
			{this.render_OriginZone(event)}
			{this.render_TargetZone(event)}
		</LL_V_L>;
	}

	private render_OriginZone = (event: DragEvent<any>) => {
		return <LL_V_L className={'ts-dnd__debug-menu__section'}>
			<h2>Origin Zone</h2>
			<div>Zone ID: {event.origin.zone.getId()}</div>
			<div>Item Index: {event.origin.index}</div>
		</LL_V_L>;
	};

	private render_TargetZone = (event: DragEvent<any>) => {
		return <LL_V_L className={'ts-dnd__debug-menu__section'}>
			<h2>Target Zone</h2>
			<div>Zone ID: {event.target.zone.getId()}</div>
			<div>Item Index: {event.target.index}</div>
		</LL_V_L>;
	}
}