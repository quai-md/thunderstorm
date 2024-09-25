import {CredentialBody} from 'google-auth-library';
import {docs_v1} from 'googleapis';

export type CredentialsData = {
	credentials: CredentialBody | string,
	scopes: string[]
}

export type GoogleDocUpdateRequest<T extends keyof docs_v1.Schema$Request = keyof docs_v1.Schema$Request> = docs_v1.Schema$Request[T]

const kaki: GoogleDocUpdateRequest<'i'> = {};