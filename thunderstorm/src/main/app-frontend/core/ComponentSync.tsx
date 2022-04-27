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

/**
 * Created by tacb0ss on 28/07/2018.
 */
import * as React from 'react';

import {_clearTimeout, _keys, _setTimeout, _sortArray, Logger, LogLevel, LogParam, TimerHandler} from '@nu-art/ts-common';
import {StorageModule} from '../modules/StorageModule';
import {ResourcesModule} from '../modules/ResourcesModule';
import {BrowserHistoryModule} from '../modules/HistoryModule';
import {Thunder} from './Thunder';


export abstract class ComponentSync<P = any, S = any>
	extends React.Component<P, S> {

	private logger: Logger;
	private timeoutMap: { [k: string]: number } = {};
	protected mounted = false;

	constructor(props: P) {
		super(props);
		this.logger = new Logger(this.constructor.name);

		const __render = this.render?.bind(this);
		this.render = () => {
			this.logInfo('rendering');
			return __render();
		};

		const __componentDidMount = this.componentDidMount?.bind(this);
		this.componentDidMount = () => {
			// @ts-ignore
			Thunder.getInstance().addUIListener(this);

			__componentDidMount?.();
			this.mounted = true;
		};

		const __componentWillUnmount = this.componentWillUnmount?.bind(this);
		this.componentWillUnmount = () => {
			__componentWillUnmount?.();
			// @ts-ignore
			Thunder.getInstance().removeUIListener(this);
			this.mounted = false;
		};

		this.deriveStateFromProps.bind(this);
		const state = this.deriveStateFromProps(props);
		if (state)
			this.state = state;
	}

	UNSAFE_componentWillReceiveProps(nextProps: P) {
		if (!this.shouldComponentUpdate(nextProps, this.state, undefined))
			return;

		if (this.state) //skip the first time when the component MUST update
			this.logInfo('deriving state from new props...');

		const state = this.deriveStateFromProps(nextProps);
		if (state)
			this.setState(state);
	}

	protected abstract deriveStateFromProps(nextProps: P): S | undefined;

	debounce(handler: TimerHandler, key: string, ms = 0) {
		_clearTimeout(this.timeoutMap[key]);
		this.timeoutMap[key] = _setTimeout(handler, ms);
	}

	throttle(handler: TimerHandler, key: string, ms = 0) {
		if (this.timeoutMap[key])
			return;
		this.timeoutMap[key] = _setTimeout(() => {
			handler();
			delete this.timeoutMap[key];
		}, ms);
	}

	shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
		const shouldRender = () => {
			const propKeys = _sortArray(_keys(this.props));
			const nextPropsKeys = _sortArray(_keys(nextProps));
			const stateKeys = _sortArray(_keys(this.state));
			const nextStateKeys = _sortArray(_keys(nextState));

			if (propKeys.length !== nextPropsKeys.length) return true;
			if (propKeys.some((key, i) => propKeys[i] !== nextPropsKeys[i] || this.props[propKeys[i]] !== nextProps[nextPropsKeys[i]])) return true;

			if (stateKeys.length !== nextStateKeys.length) return true;
			if (stateKeys.some((key, i) => stateKeys[i] !== nextStateKeys[i] || this.state[stateKeys[i]] !== nextState[nextStateKeys[i]])) return true;
			return false;
		};

		return shouldRender();
	}

	protected logVerbose(...toLog: LogParam[]): void {
		this.logImpl(LogLevel.Verbose, false, toLog);
	}

	protected logDebug(...toLog: LogParam[]): void {
		this.logImpl(LogLevel.Debug, false, toLog);
	}

	protected logInfo(...toLog: LogParam[]): void {
		this.logImpl(LogLevel.Info, false, toLog);
	}

	protected logWarning(...toLog: LogParam[]): void {
		this.logImpl(LogLevel.Warning, false, toLog);
	}

	protected logError(...toLog: LogParam[]): void {
		this.logImpl(LogLevel.Error, false, toLog);
	}

	protected log(level: LogLevel, bold: boolean, ...toLog: LogParam[]): void {
		this.logImpl(level, bold, toLog);
	}

	private logImpl(level: LogLevel, bold: boolean, toLog: LogParam[]): void {
		this.logger.log(level, bold, toLog);
	}

	static store(key: string, value: string | object): void {
		StorageModule.set(key, value);
	}

	static load(key: string, defaultValue: string | number | object | undefined): string | number | object | null {
		return StorageModule.get(key, defaultValue);
	}

	static getElementId(e: React.BaseSyntheticEvent) {
		return (e.currentTarget as HTMLElement).id;
	}

	static getImageUrl(_relativePath: string) {
		let relativePath = _relativePath;
		if (!relativePath)
			return '';

		if (relativePath.indexOf('.') === -1)
			relativePath += '.png';

		return ResourcesModule.getImageUrl(relativePath);
	}

	static getQueryParameter(name: string) {
		return BrowserHistoryModule.getQueryParams()[name];
	}

	static getUrl() {
		return BrowserHistoryModule.getCurrent().pathname;
	}

	toString() {
		return this.constructor.name;
	}
}

