/*
 * Permissions management system, define access level for each of
 * your server apis, and restrict users by giving them access levels
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

import {ApiDef, BodyApi, HttpMethod, QueryApi} from '@nu-art/thunderstorm';
import {DB_Document, LiveDocHistoryReqParams, LiveDocReqParams, Request_UpdateDocument} from './types';


export const ApiDef_LiveDoc_Get: ApiDef<QueryApi<DB_Document, LiveDocReqParams>> = {
	method: HttpMethod.GET,
	path: 'unique'
};

export const ApiDef_LiveDoc_History: ApiDef<QueryApi<void, LiveDocHistoryReqParams>> = {
	method: HttpMethod.GET,
	path: 'change-history'
};

export const ApiDef_LiveDoc_Upsert: ApiDef<BodyApi<void, Request_UpdateDocument>> = {
	method: HttpMethod.POST,
	path: 'upsert'
};