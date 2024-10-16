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

import {HeaderKey_SessionId} from './headers';


export const HeaderKey_Env = 'x-env';
export const HeaderKey_CurrentPage = 'x-current-page';

export type Browser = 'chrome';//| "firefox" | "blink" | "edge" | "ie" | "safari" | "opera"

export const DefaultHttpServerConfig = {
	'bodyParserLimit': 200,
	'cors': {
		'headers': [
			HeaderKey_SessionId,
			'x-browser-type',
			'x-app-version'
		],
		'methods': [
			'GET',
			'POST'
		],
		'responseHeaders': [
			HeaderKey_SessionId
		]
	},
	'host': 'localhost'
};