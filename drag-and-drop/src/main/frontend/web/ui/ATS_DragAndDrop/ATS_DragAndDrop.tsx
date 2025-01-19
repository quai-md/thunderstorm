import * as React from 'react';
import {AppToolsScreen, ComponentSync, LL_H_C, LL_V_L, TS_AppTools} from '@nu-art/thunderstorm/frontend';
import {DNDTestItemStatuses, DNDTest_Item, DNDTest_Item_Status} from './types';
import {StorageKey_DNDTestItems} from './consts';
import {dndTest_generateItems} from './utils';
import './ATS_DragAndDrop.scss';
import {DropZone_Web} from '../DropZone_Web';
import {Draggable_Web} from '../Draggable_Web';

type State = {
	items: DNDTest_Item[]
};

export class ATS_DragAndDrop
	extends ComponentSync<{}, State> {

	protected deriveStateFromProps(nextProps: {}, state: State) {
		state.items ??= this.getTestItems();
		return state;
	}

	private getTestItems() {
		let items = StorageKey_DNDTestItems.get();
		if (!items) {
			items = dndTest_generateItems();
			StorageKey_DNDTestItems.set(items);
		}
		return items;
	}

	static Screen: AppToolsScreen = {
		key: 'ats-dnd-test',
		name: 'Drag And Drop Test',
		group: 'TS/Drag And Drop',
		renderer: this,
	};

	render() {
		return <LL_V_L id={'ats-dnd-test'}>
			{TS_AppTools.renderPageHeader('Drag And Drop Test')}
			{this.render_Stage()}
		</LL_V_L>;
	}

	private render_Stage = () => {
		return <LL_H_C className={'ats-dnd-test__stage'}>
			{DNDTestItemStatuses.map(this.renderStatusDropZone)}
		</LL_H_C>;
	};

	private renderStatusDropZone = (status: DNDTest_Item_Status) => {
		const items = this.state.items.filter(item => item.status === status);
		return <LL_V_L className={'ats-dnd-test__status-board'} key={status}>
			<div className={'ats-dnd-test__status-board-title'}>{status}</div>
			<DropZone_Web contextKey={'test'}>
				{items.map(this.renderItem)}
			</DropZone_Web>
		</LL_V_L>;
	};

	private renderItem = (item: DNDTest_Item) => {
		return <Draggable_Web contextKey={'test'} className={'ats-dnd-test__item'} key={item.id}>
			<div className={'ats-dnd-test__item__id'}>{item.id}</div>
			<div className={'ats-dnd-test__item__label'}>{item.label}</div>
		</Draggable_Web>;
	};
}