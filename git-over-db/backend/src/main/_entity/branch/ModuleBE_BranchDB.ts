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

import {DBApiConfigV3, ModuleBE_BaseDB} from '@nu-art/thunderstorm-backend';
import {DBDef_Branch, DBProto_Branch} from '@nu-art/git-over-db-shared';

type Config = DBApiConfigV3<DBProto_Branch>;

export class ModuleBE_BranchDB_Class
	extends ModuleBE_BaseDB<DBProto_Branch, Config> {

	constructor() {
		super(DBDef_Branch);
	}
}

export const ModuleBE_BranchDB = new ModuleBE_BranchDB_Class();
