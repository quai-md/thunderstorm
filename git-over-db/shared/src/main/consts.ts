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

/** Reserved branch id: edits go directly to live collections. */
export const LIVE_BRANCH_ID = 'live';

export const GitOverDbDBGroup = 'git-over-db';

export type OverlayEntryKind = 'document' | 'tombstone';

export const overlayEntryId = (branchId: string, dbKey: string, docId: string) => `${branchId}|${dbKey}|${docId}`;

export const parseOverlayEntryId = (entryId: string): { branchId: string; dbKey: string; docId: string } => {
	const [branchId, dbKey, ...rest] = entryId.split('|');
	const docId = rest.join('|');
	if (!branchId || !dbKey || !docId)
		throw new Error(`Invalid overlay entry id: ${entryId}`);
	return {branchId, dbKey, docId};
};
