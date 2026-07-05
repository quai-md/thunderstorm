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
import {DB_OverlayEntry} from './_entity/overlay/types.js';

export type MergeResolutionDocument<T extends DB_Object = DB_Object> = {
	dbKey: string;
	docId: UniqueId;
	resolved: T;
	expectedLiveUpdated: number;
};

export type MergeResolutionDelete = {
	dbKey: string;
	docId: UniqueId;
	kind: 'delete';
	expectedLiveUpdated: number;
};

export type MergeResolution = MergeResolutionDocument | MergeResolutionDelete;

export const composeBranchCacheView = <T extends DB_Object>(
	liveDocs: readonly T[],
	branchDocs: readonly T[],
	tombstonedDocIds: readonly UniqueId[],
): T[] => {
	const byId = new Map<UniqueId, T>(liveDocs.map(doc => [doc._id, doc]));
	for (const doc of branchDocs)
		byId.set(doc._id, doc);
	for (const docId of tombstonedDocIds)
		byId.delete(docId);
	return [...byId.values()];
};

export type BranchOverlaySlice = {
	documents: DB_Object[];
	tombstonedDocIds: UniqueId[];
};

export const sliceOverlayEntriesForCollection = (
	entries: readonly DB_OverlayEntry[],
	dbKey: string,
): BranchOverlaySlice => {
	const documents: DB_Object[] = [];
	const tombstonedDocIds: UniqueId[] = [];
	for (const entry of entries) {
		if (entry.dbKey !== dbKey)
			continue;
		if (entry.kind === 'tombstone')
			tombstonedDocIds.push(entry.docId);
		else if (entry.document)
			documents.push(entry.document);
	}
	return {documents, tombstonedDocIds};
};
