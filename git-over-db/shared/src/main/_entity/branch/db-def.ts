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

import {DBDef_V3, tsValidateArray, tsValidateString} from '@nu-art/ts-common';
import {DBProto_Branch} from './types.js';
import {GitOverDbDBGroup} from '../../consts.js';

const Validator_ModifiableProps: DBProto_Branch['modifiablePropsValidator'] = {
	label: tsValidateString(),
	participants: tsValidateArray(tsValidateString()),
};

export const DBDef_Branch: DBDef_V3<DBProto_Branch> = {
	modifiablePropsValidator: Validator_ModifiableProps,
	generatedPropsValidator: {},
	versions: ['1.0.0'],
	dbKey: 'git-over-db--branch',
	entityName: 'GitOverDbBranch',
	frontend: {
		group: GitOverDbDBGroup,
		name: 'branch',
	},
	backend: {
		name: 'git-over-db--branch',
	},
};
