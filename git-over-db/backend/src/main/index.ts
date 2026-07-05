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

import {Module} from '@nu-art/ts-common';
import {ModulePackBE_Branch} from './_entity/branch/module-pack.js';
import {ModulePackBE_Overlay} from './_entity/overlay/module-pack.js';
import {ModuleBE_GitOverDb} from './ModuleBE_GitOverDb.js';

export const ModulePackBE_GitOverDb: Module[] = [
	...ModulePackBE_Branch,
	...ModulePackBE_Overlay,
	ModuleBE_GitOverDb,
];

export * from './ModuleBE_GitOverDb.js';
export * from './consts.js';
export * from './_entity.js';
