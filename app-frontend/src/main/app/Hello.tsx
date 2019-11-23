/*
 * A typescript & react boilerplate with api call example
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

import * as React from "react";
import {
	ExampleModule,
	RequestKey_PostApi,
} from "@modules/ExampleModule";
import {
	BaseComponent,
	OnRequestListener
} from "@nu-art/thunder";

export class Hello
	extends BaseComponent<{}, { label: string }>
	implements OnRequestListener {

	constructor(props: any) {
		super(props);
		this.state = {
			label: "Hello World"
		};
	}

	static getMessageFromServer() {
		ExampleModule.getMessageFromServer();
	}

	render() {
		const onClick = Hello.getMessageFromServer;
		return <h1 onClick={onClick}>{this.state.label}</h1>;
	}

	onRequestCompleted = (key: string, success: boolean) => {
		if (!success)
			return;

		switch (key) {
			default:
				return;

			case RequestKey_PostApi:
				this.setState({label: ExampleModule.getMessage()});
		}
	};
}