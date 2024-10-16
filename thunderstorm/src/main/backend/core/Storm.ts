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

import {BeLogged, LogClient_Function, LogClient_Terminal, LogLevel, Module} from '@nu-art/ts-common';
import {Firebase_ExpressFunction} from '@nu-art/firebase/backend-functions';
import {BaseStorm} from './BaseStorm';
import {HttpRoute, RouteResolver} from '../modules/server/route-resolvers';
import {HttpServer} from '../modules/server/HttpServer';
import {ModuleBE_BaseFunction, ModuleBE_Firebase} from '@nu-art/firebase/backend';
import {ServerApi} from '../modules/server/server-api';


const modules: Module[] = [
	HttpServer,
	ModuleBE_Firebase,
];

export class Storm
	extends BaseStorm {

	private routeResolver!: RouteResolver;
	private functions: any[] = [];

	constructor() {
		super();
		this.addModulePack(modules);
		this.setMinLevel(LogLevel.Info);
	}

	init() {
		BeLogged.addClient(process.env.GCLOUD_PROJECT && process.env.FUNCTIONS_EMULATOR ? LogClient_Terminal : LogClient_Function);
		ServerApi.isDebug = this.config.isDebug === true;

		super.init();
		this.routeResolver.resolveApi();

		if (this.config.printRoutes === true)
			this.routeResolver.printRoutes();

		return this;
	}

	setInitialRouteResolver(routeResolver: RouteResolver) {
		this.routeResolver = routeResolver;
		return this;
	}

	startServer(onStarted?: () => Promise<void>) {
		const modulesAsFunction: ModuleBE_BaseFunction[] = this.modules.filter((module: ModuleBE_BaseFunction) => {
			const b = module instanceof ModuleBE_BaseFunction;
			// console.log(`${module.getName()} function ${b}`)
			return b;
		});

		this.functions = [new Firebase_ExpressFunction(HttpServer.getExpress()), ...modulesAsFunction];

		this.startServerImpl(onStarted)
			.then(() => this.logInfo('Server Started!!'))
			.catch(reason => {
				this.logError('failed to launch server', reason);
				throw reason;
			});

		return this.functions.reduce((toRet, _function) => {
			toRet[_function.getName()] = _function.getFunction();
			return toRet;
		}, {});
	}

	getRoutes(): HttpRoute[] {
		return this.routeResolver.resolveRoutes();
	}

	build(onStarted?: () => Promise<void>) {
		return this.startServer(onStarted);
	}

	private async startServerImpl(onStarted?: () => Promise<void>) {
		const label = 'Resolving Config';
		console.time(label);
		await this.resolveConfig();
		console.timeEnd(label);

		this.init();

		await HttpServer.startServer();
		const functions = await Promise.all(this.functions.map(moduleAsFunction => moduleAsFunction.onFunctionReady()));
		onStarted && await onStarted();

		return functions;
	}

	static getInstance(): Storm {
		return Storm.instance as Storm;
	}

	public getConfig() {
		return this.config;
	}
}
