/*
 * Thunderstorm is a full web app framework!
 *
 * Typescript & Express backend infrastructure that natively runs on firebase function
 * Typescript & React frontend infrastructure
 *
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as React from 'react';
import {ReactNode} from 'react';
import {Example_NewProps} from './Example_NewProps';
import {SimpleListAdapter} from '../adapter/Adapter';
import './TS_Playground.scss';
import {LL_H_C, LL_V_L} from '../Layouts';
import {StorageKey} from '../../modules/ModuleFE_LocalStorage';
import {TS_Tree} from '../TS_Tree';
import {_className} from '../../utils/tools';
import {TS_ErrorBoundary} from '../TS_ErrorBoundary';
import {TS_Route} from '../../modules/routing/types';
import {TS_NavLink} from '../../modules/routing/ModuleFE_RoutingV2';
import {md5} from '@nu-art/ts-common';
import {Outlet} from 'react-router-dom';


const selectedPlaygroundStorage = new StorageKey<string>('selected-playground');
const collapsedPlaygroundStorage = new StorageKey<boolean>('collapsed-playground');

export type PlaygroundProps = {}

type State = {
	selectedScreen?: PlaygroundScreen;
	collapsed: boolean;
}

export type PlaygroundScreen<T extends any = any> = {
	name: string;
	renderer: React.ComponentType<T>;
	data?: T[];
}

export class TS_Playground
	extends React.Component<PlaygroundProps, State> {

	static screens: PlaygroundScreen[];
	static collapseCaret: (() => React.ReactNode) | ReactNode;

	static Route(): TS_Route<{}> {
		return {
			path: 'playground',
			key: 'playground',
			Component: this,
			children: TS_Playground.screens.map(screen => {
				return {key: screen.name, path: md5(screen.name), Component: screen.renderer as React.ComponentClass};
			})
		};
	}

	constructor(props: PlaygroundProps) {
		super(props);
		const selectedPlaygroundKey = selectedPlaygroundStorage.get();
		this.state = {
			selectedScreen: TS_Playground.screens.find(s => s.name === selectedPlaygroundKey),
			collapsed: collapsedPlaygroundStorage.get() ?? false,
		};
	}

	render() {
		const adapter = SimpleListAdapter<PlaygroundScreen>(TS_Playground.screens, item => <TS_NavLink
			route={TS_Playground.Route().children!.find(i => i.key === item.item.name)!}
			className={({isActive, isPending}) => _className('ts-playground__nav-item', isActive ? 'selected' : undefined)}
		>
			{item.item.name}
		</TS_NavLink>);
		const className = _className('ts-playground__selector', this.state.collapsed ? 'ts-playground__selector-collapsed' : undefined);

		return <LL_H_C className="ts-playground">
			<LL_V_L className={className}>
				{this.renderHeader()}
				<TS_Tree adapter={adapter}/>
			</LL_V_L>
			<TS_ErrorBoundary>
				<div className="ts-playground__container"><Outlet/></div>
			</TS_ErrorBoundary>
		</LL_H_C>;
	}

	private renderHeader() {
		const caret = typeof TS_Playground.collapseCaret === 'function' ? TS_Playground.collapseCaret() : TS_Playground.collapseCaret;
		return <LL_H_C className={'ts-playground__selector__header'}>
			<span className={'header__title'}>Playgrounds</span>
			<div className={'header__caret'} onClick={() => {
				const newCollapse = !this.state.collapsed;
				this.setState({collapsed: newCollapse});
				collapsedPlaygroundStorage.set(newCollapse);
			}}>{caret}</div>
		</LL_H_C>;
	}

	renderPlayground() {
		if (!this.state.selectedScreen)
			return <div>Select a playground</div>;

		const Renderer = this.state.selectedScreen.renderer;
		const data = this.state.selectedScreen.data;

		if (!data || data.length === 0)
			return <Renderer/>;

		if (data.length === 1)
			return <Renderer {...data[0]}/>;

		return <Example_NewProps name={this.state.selectedScreen.name} data={data} renderer={this.state.selectedScreen.renderer}/>;
	}
}
