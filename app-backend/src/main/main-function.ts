/*
 * A backend boilerplate with example apis
 *
 * Copyright (C) 2018  Adam van der Kruk aka TacB0sS
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
 * Created by tacb0ss on 10/07/2018.
 */
import {
	HttpServer,
	HttpServer_Class,
	ServerApi
} from "@nu-art/server/HttpServer";
import {
	BeLogged,
	createModuleManager,
	Module,
	TerminalLogClient,
	merge
} from "@nu-art/core";
import * as bodyParser from "body-parser";

import {
	FirebaseModule,
	Firebase_EventType
} from "@nu-art/server/FirebaseModule";
import * as firebase from "firebase-admin";
import {ExampleModule} from "@modules/ExampleModule";

async function resolveConfig(environment: { name: string }) {
	/*
	 *  SETUP, CONFIG & INIT
	 */
	const app = firebase.initializeApp();
	const defaultConfigNode = app.database().ref(`/_config/default`);
	const configNode = app.database().ref(`/_config/${environment.name}`);

	const async = [];
	async.push(defaultConfigNode.once(Firebase_EventType.Value));
	async.push(configNode.once(Firebase_EventType.Value));
	const config = await Promise.all(async);


	let initialized = 0;
	const terminationListener = (snapshot: any) => {
		if (initialized >= 2) {
			console.log("CONFIGURATION HAS CHANGED... KILLING PROCESS!!!");
			process.exit(2);
		}

		initialized++;
	};

	defaultConfigNode.on("value", terminationListener);
	configNode.on("value", terminationListener);

	return merge(config[0] || {}, config[1] || {});
}

export async function main(environment: { name: string }) {
	BeLogged.addClient(TerminalLogClient);

	const configAsObject = await resolveConfig(environment);

	const modules: Module<any>[] =
		      [
			      HttpServer,
			      FirebaseModule,
			      ExampleModule,
		      ];

	HttpServer_Class.addMiddleware(bodyParser.urlencoded({extended: false}));

	createModuleManager().setConfig(configAsObject).setModules(...modules).init();

	/*
	 *  SETUP HttpServer
	 */
	ServerApi.isDebug = configAsObject.isDebug;
	const _urlPrefix: string = !process.env.GCLOUD_PROJECT ? "/api" : "";
	HttpServer.resolveApi(require, __dirname, _urlPrefix, __dirname + "/api", __dirname + "/api");
	HttpServer.printRoutes(process.env.GCLOUD_PROJECT ? "/api" : "");
	const httpPromise = HttpServer.startServer();

	return Promise.all([httpPromise]);
}

export async function mainTerminate() {
	return HttpServer.terminate();
}
