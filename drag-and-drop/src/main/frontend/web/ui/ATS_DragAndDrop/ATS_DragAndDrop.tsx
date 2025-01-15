import * as React from 'react';
import {AppToolsScreen, ComponentSync, LL_H_C, LL_V_L, TS_AppTools} from '@nu-art/thunderstorm/frontend';
import {DNDTest_Item} from './types';
import {StorageKey_DNDTestItems} from './consts';
import {dndTest_generateItems} from './utils';

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

		</LL_H_C>;
	};
}