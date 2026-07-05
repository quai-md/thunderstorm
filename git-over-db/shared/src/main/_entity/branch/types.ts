/*
 * Git-over-DB capability — sparse overlay branching for Thunderstorm DB modules.
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

import {AuditableV2, DB_Object, DBProto, Proto_DB_Object, VersionsDeclaration} from '@nu-art/ts-common';

type VersionTypes_Branch = {
	'1.0.0': DB_Branch
};
type Versions = VersionsDeclaration<['1.0.0'], VersionTypes_Branch>;
type Dependencies = {};
type UniqueKeys = '_id';
type GeneratedProps = never;
type Proto = Proto_DB_Object<DB_Branch, 'git-over-db--branch', GeneratedProps, Versions, UniqueKeys, Dependencies>;

export type DBProto_Branch = DBProto<Proto>;

export type UI_Branch = DBProto_Branch['uiType'];
export type DB_Branch = DB_Object & AuditableV2 & {
	label: string;
	participants: string[];
};
