import {Minute, TypedMap, UniqueId} from '@nu-art/ts-common';
import {GoogleDocs_UpdateRequest} from './types';
import {ApiDefResolver, BodyApi, HttpMethod} from '../types';

export type GoogleDocs_UpdateDocument = {
	request: { documentId: UniqueId, updates: TypedMap<GoogleDocs_UpdateRequest> },
	response: void
}

export type ApiStruct_GoogleDocs = {
	_v1: {
		updateDocument: BodyApi<GoogleDocs_UpdateDocument['response'], GoogleDocs_UpdateDocument['request']>
	}
}

export const ApiDef_GoogleDocs: ApiDefResolver<ApiStruct_GoogleDocs> = {
	_v1: {
		updateDocument: {method: HttpMethod.POST, path: '/v1/google-docs/update-document', timeout: Minute}
	}
};