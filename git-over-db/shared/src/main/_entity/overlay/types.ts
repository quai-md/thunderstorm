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

import {DB_Object, DBProto, Proto_DB_Object, VersionsDeclaration} from '@nu-art/ts-common';
import {OverlayEntryKind} from '../../consts.js';

type VersionTypes_Overlay = {
	'1.0.0': DB_OverlayEntry
};
type Versions = VersionsDeclaration<['1.0.0'], VersionTypes_Overlay>;
type Dependencies = {};
type UniqueKeys = '_id';
type GeneratedProps = never;
type Proto = Proto_DB_Object<DB_OverlayEntry, 'git-over-db--overlay', GeneratedProps, Versions, UniqueKeys, Dependencies>;

export type DBProto_Overlay = DBProto<Proto>;

export type UI_OverlayEntry = DBProto_Overlay['uiType'];
export type DB_OverlayEntry = DB_Object & {
	branchId: string;
	dbKey: string;
	docId: string;
	kind: OverlayEntryKind;
	document?: DB_Object;
	origin: DB_Object;
	baseUpdated: number;
};
