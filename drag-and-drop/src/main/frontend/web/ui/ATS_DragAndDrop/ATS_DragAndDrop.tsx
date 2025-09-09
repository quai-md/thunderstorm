import * as React from 'react';
import {AppToolsScreen, ComponentSync, EditableItem, LL_H_C, LL_V_L, ModuleFE_Thunderstorm, TS_AppTools} from '@nu-art/thunderstorm/frontend';
import {DNDTest_Item, DNDTest_Item_Status, DNDTestItemStatuses} from './types';
import {StorageKey_DNDTestItems} from './consts';
import {dndTest_generateItems} from './utils';
import './ATS_DragAndDrop.scss';
import {voidFunction} from '@nu-art/ts-common';
import {DragZone_Web} from '../components/DragZone_Web/DragZone_Web';
import {DragItem_Web} from '../components/DragItem_Web/DragItem_Web';
import {DragContext} from '../../../core/DragContext';
import {DragEvent} from '../../../core';
import {DragDebugMenu_Web} from '../components/DragDebugWindow_Web/DragDebugMenu_Web';

type Props = object;

type State = {
	items: DNDTest_Item[]
};

export class ATS_DragAndDrop
	extends ComponentSync<Props, State> {

	static Screen: AppToolsScreen = {
		key: 'ats-dnd-test',
		name: 'Drag And Drop Test',
		group: 'TS/Drag And Drop',
		renderer: this,
	};

	private readonly dragContext = new DragContext<DNDTest_Item>('ats-dnd');

	//######################### Life Cycle #########################

	protected deriveStateFromProps(nextProps: {}, state: State) {
		state.items ??= this.getTestItems();
		return state;
	}

	//######################### Logic #########################

	private getTestItems() {
		let items = StorageKey_DNDTestItems.get();
		if (!items) {
			items = dndTest_generateItems();
			StorageKey_DNDTestItems.set(items);
		}
		return items;
	}

	private getItemEditable = (item: DNDTest_Item) => {
		const editable = new EditableItem<DNDTest_Item>(item, async item => {
			const allItems = this.getTestItems();
			const currentIndex = allItems.findIndex(existing => existing.id === item.id);
			allItems.splice(currentIndex, 1, item);
			StorageKey_DNDTestItems.set(allItems);
			this.forceUpdate();
			return item;
		}, voidFunction);
		editable.setAutoSave(true);
		return editable;
	};

	private setItemStatus = async (event: DragEvent<DNDTest_Item>, status: DNDTest_Item_Status) => {
		const editable = event.editable;
		if (editable.item.status === status)
			return;

		editable.updateObj({status});
	};

	//######################### Render #########################

	render() {
		return <LL_V_L id={'ats-dnd-test'}>
			{TS_AppTools.renderPageHeader('Drag And Drop Test')}
			{this.render_Stage()}
			<DragDebugMenu_Web context={this.dragContext}/>
		</LL_V_L>;
	}

	private render_Stage = () => {
		return <LL_H_C className={'ats-dnd-test__stage'}>
			{DNDTestItemStatuses.map(this.renderStatusDropZone)}
		</LL_H_C>;
	};

	private renderStatusDropZone = (status: DNDTest_Item_Status) => {
		const items = this.state.items.filter(item => item.status === status);
		const id = `drag-zone__${status}`;
		return <LL_V_L className={'ats-dnd-test__status-board'} key={status}>
			<div className={'ats-dnd-test__status-board-title'}>{status}</div>
			<DragZone_Web<DNDTest_Item>
				key={id}
				id={id}
				context={this.dragContext}
				processor={e => this.setItemStatus(e, status)}
			>
				{items.map(this.renderItem)}
			</DragZone_Web>
		</LL_V_L>;
	};

	private renderItem = (item: DNDTest_Item) => {
		const editable = this.getItemEditable(item);
		return <DragItem_Web<DNDTest_Item>
			key={item.id}
			editable={editable}
			context={this.dragContext}
		>
			<button
				className={'ats-dnd-test__item__id'}
				onClick={e => {
					e.stopPropagation();
					ModuleFE_Thunderstorm.copyToClipboard(item.id);
				}}
			>{item.id}</button>
			<div className={'ats-dnd-test__item__label'}>{item.label}</div>
		</DragItem_Web>;
	};
}