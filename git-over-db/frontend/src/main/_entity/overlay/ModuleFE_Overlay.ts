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

import {ModuleFE_BaseDB} from '@nu-art/thunderstorm-frontend/index';
import {DispatcherDef, ThunderDispatcherV3} from '@nu-art/thunderstorm-frontend/core/db-api-gen/types';
import {ModuleSyncType} from '@nu-art/thunderstorm-frontend/modules/db-api-gen/types';
import {DBDef_Overlay, DBProto_Overlay} from '@nu-art/git-over-db-shared';

export type DispatcherType_Overlay = DispatcherDef<DBProto_Overlay, `__onGitOverDbOverlayUpdated`>;

export const dispatch_onGitOverDbOverlayChanged = new ThunderDispatcherV3<DispatcherType_Overlay>('__onGitOverDbOverlayUpdated');

export class ModuleFE_Overlay_Class
	extends ModuleFE_BaseDB<DBProto_Overlay> {

	constructor() {
		super(DBDef_Overlay, dispatch_onGitOverDbOverlayChanged, ModuleSyncType.APISync);
	}
}

export const ModuleFE_Overlay = new ModuleFE_Overlay_Class();
