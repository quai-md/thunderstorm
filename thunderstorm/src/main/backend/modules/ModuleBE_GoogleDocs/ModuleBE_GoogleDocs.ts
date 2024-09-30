import {MissingPermissionException, Module, UniqueId} from '@nu-art/ts-common';
import {GoogleAuth, OAuth2Client} from 'google-auth-library';
import {docs_v1, google} from 'googleapis';
import {Key_GoogleDocsServiceAccount} from './consts';
import {ModuleBE_Auth} from '@nu-art/google-services/backend';
import {ModuleBE_SecretManager} from '@nu-art/google-services/backend/modules/ModuleBE_SecretManager';
import {Storm} from '../../core/Storm';
import {HttpCodes} from '@nu-art/ts-common/core/exceptions/http-codes';

type Config = {
	scopes: string[],
	secretName: string
}

class ModuleBE_GoogleDocs_Class
	extends Module<Config> {

	// @ts-ignore
	private googleDocs: docs_v1.Docs;

	//######################### Setup #########################

	constructor() {
		super('ModuleBE_GoogleDocs');

		this.getGoogleAuthClient().then(authClient => {
			this.googleDocs = google.docs({version: 'v1', auth: authClient});
		});
	}

	private getGoogleAuthClient = async (): Promise<OAuth2Client> => {
		try {
			const isLocal = Storm.getInstance().getEnvironment() === 'local';

			// if local env, resolve the authentication client from the rtdb
			if (isLocal) {
				return this.resolveLocalAuthClient();
			}

			// resolve from secret manager
			return new GoogleAuth({
				credentials: JSON.parse(await ModuleBE_SecretManager.getSecret(this.config.secretName)),
				scopes: this.config.scopes
			}).getClient();
		} catch (err: any) {
			throw new MissingPermissionException('cannot authenticate with google apis', err);
		}
	};

	private resolveLocalAuthClient = () => {
		const authConfig = ModuleBE_Auth.getAuthConfig(Key_GoogleDocsServiceAccount);
		return new GoogleAuth({
			credentials: JSON.parse(authConfig as string),
			scopes: this.config.scopes
		}).getClient();
	};

	//######################### Internal Logic #########################

	// @ts-ignore
	private findPlaceholder(documentContent: docs_v1.Schema$Document, placeholder: string): {
		startIndex: number;
		endIndex: number
	} | null {
		// Ensure body and content exist, return null if not
		const content = documentContent.body?.content ?? [];

		for (const element of content) {
			const paragraph = element.paragraph;
			const paragraphStartIndex = element.startIndex;

			if (paragraph) {
				const elements = paragraph.elements ?? [];
				for (const paragraphElement of elements) {
					const textRun = paragraphElement.textRun;

					if (textRun?.content?.includes(placeholder)) {
						const startIndex = paragraphStartIndex as number;
						const endIndex = startIndex + textRun.content.length;

						return {startIndex, endIndex};
					}
				}
			}
		}

		return null;
	}

	/**
	 * Resolve the google document body from the google docs app using the doc id
	 * @param docId The google document id to query.
	 */
	private resolveDocument = async (docId: UniqueId): Promise<docs_v1.Schema$Document> => {
		try {
			const getDocumentResponse = await this.googleDocs.documents.get({documentId: docId});
			return getDocumentResponse.data;
		} catch (err: any) {
			throw this.handleError(err);
		}
	};

	/**
	 * Default error handler that formats and throw errors in thunderstorm controlled format
	 * @param error The error object to resolve the type from
	 */
	private handleError = (error: any) => {
		switch (error.response.status) {
			case HttpCodes._4XX.NOT_FOUND.code:
				return HttpCodes._4XX.NOT_FOUND('Document not found in google docs');
			case HttpCodes._4XX.FORBIDDEN.code:
				return HttpCodes._4XX.FORBIDDEN('Insufficient permission');
			default:
				return HttpCodes._5XX.INTERNAL_SERVER_ERROR('Error occurred when trying to update google doc');
		}
	};

	//######################### Public Logic #########################

	public updateDocumentContent = async (docId: UniqueId): Promise<void> => {
		const documentBody: docs_v1.Schema$Document = await this.resolveDocument(docId);

	};

	//######################### Document Manipulation #########################

}

export const ModuleBE_GoogleDocs = new ModuleBE_GoogleDocs_Class();