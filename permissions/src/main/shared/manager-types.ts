/*
 * ts-common is the basic building blocks of our typescript projects
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

import {
	DB_Object,
} from '@nu-art/ts-common';
import {Auditable} from '@nu-art/ts-common';

export type DB_PermissionDomain = DB_Object & Auditable & {
	projectId: string
	namespace: string
};

export type DB_PermissionProject = DB_Object & Auditable & {
	name: string,
	customKeys?: string[]
}


export type DB_PermissionAccessLevel = DB_Object & Auditable & {
	domainId: string
	name: string
	value: number
}


export type DB_PermissionApi = DB_Object & Auditable & {
	projectId: string
	path: string
	accessLevelIds?: string[],
	deprecated?: boolean,
	onlyForApplication?: boolean
}

