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

import {DB_Object, UniqueId} from '@nu-art/ts-common';
import {composeBranchCacheView} from '../main/types.js';
import {assert} from 'chai';

describe('composeBranchCacheView', () => {
	const liveA = {_id: 'a', __created: 1, __updated: 1, name: 'live-a'} as DB_Object;
	const liveB = {_id: 'b', __created: 1, __updated: 1, name: 'live-b'} as DB_Object;
	const branchA = {_id: 'a', __created: 1, __updated: 2, name: 'branch-a'} as DB_Object;
	const branchC = {_id: 'c', __created: 1, __updated: 1, name: 'branch-c'} as DB_Object;

	it('replaces live doc when branch has same id', () => {
		const result = composeBranchCacheView([liveA, liveB], [branchA], []);
		assert.deepEqual(result.map(d => d._id).sort(), ['a', 'b']);
		assert.equal(result.find(d => d._id === 'a')?.name, 'branch-a');
	});

	it('adds branch-only docs and removes tombstones', () => {
		const result = composeBranchCacheView([liveA, liveB], [branchC], ['b' as UniqueId]);
		assert.deepEqual(result.map(d => d._id).sort(), ['a', 'c']);
	});
});
