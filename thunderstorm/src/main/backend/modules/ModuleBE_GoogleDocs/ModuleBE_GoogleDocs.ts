import {_keys, MissingPermissionException, Module, TypedMap, UniqueId} from '@nu-art/ts-common';
import {CredentialBody, GoogleAuth, OAuth2Client} from 'google-auth-library';
import {docs_v1, google} from 'googleapis';
import {ModuleBE_Auth} from '@nu-art/google-services/backend';
import {ModuleBE_SecretManager} from '@nu-art/google-services/backend/modules/ModuleBE_SecretManager';
import {Storm} from '../../core/Storm';
import {HttpCodes} from '@nu-art/ts-common/core/exceptions/http-codes';
import {
	GoogleDocs_ParamRange,
	GoogleDocs_UpdateRequest,
	Key_GoogleDocsServiceAccount,
	UpdateType_List,
	UpdateType_Table,
	UpdateType_Text
} from '../../../shared';
import {addRoutes} from '../ModuleBE_APIs';
import {createBodyServerApi} from '../../core/typed-api';
import {ApiDef_GoogleDocs, GoogleDocs_UpdateDocument} from '../../../shared/google-docs/api-def';

type Config = {
	scopes: string[],
	secretName: string
}

export class ModuleBE_GoogleDocs_Class
	extends Module<Config> {

	private googleDocs!: docs_v1.Docs;

	//######################### Setup #########################

	constructor() {
		super('ModuleBE_GoogleDocs');
	}

	protected init() {
		super.init();

		// Expose api to update the document
		addRoutes([
			createBodyServerApi(ApiDef_GoogleDocs._v1.updateDocument, async (request: GoogleDocs_UpdateDocument['request']) => this.updateDocumentContent(request.documentId, request.updates))
		]);

		// initialize google apis connection
		this.getGoogleAuthClient().then(authClient => {
			this.googleDocs = google.docs({version: 'v1', auth: authClient});
		});
	}

	/**
	 * Resolve the google auth client using service account credentials from secret manager
	 * Or locally from the rtdb auth module configuration
	 */
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

	/** FOR LOCAL DEVELOPMENT
	 * Resolve the local service account from the ModuleBE_Auth configuration
	 */
	private resolveLocalAuthClient = () => {
		const authConfig = ModuleBE_Auth.getAuthConfig(Key_GoogleDocsServiceAccount);
		return new GoogleAuth({
			credentials: authConfig as CredentialBody,
			scopes: this.config.scopes
		}).getClient();
	};

	//######################### Internal Logic #########################

	/**
	 * Search the start and end index of a placeholder inside the document
	 * @param documentContent The google docs document content to parse
	 * @param placeholder The placeholder parameter to look for
	 */
	private findPlaceholder = (documentContent: docs_v1.Schema$Document, placeholder: string): GoogleDocs_ParamRange | null => {
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
	};

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
				return HttpCodes._4XX.NOT_FOUND('Document not found in google docs', error);
			case HttpCodes._4XX.FORBIDDEN.code:
				return HttpCodes._4XX.FORBIDDEN('Insufficient permission', error);
			default:
				return HttpCodes._5XX.INTERNAL_SERVER_ERROR('Error occurred when trying to update google doc', error);
		}
	};

	//######################### Public Logic #########################

	/**
	 * Public function that can be used in order to update Google Docs document content by it's id
	 * @param documentId  The document id to update
	 * @param updates The updates mapped by parameters of the template
	 */
	public updateDocumentContent = async (documentId: UniqueId, updates: TypedMap<GoogleDocs_UpdateRequest>): Promise<docs_v1.Schema$BatchUpdateDocumentResponse> => {
		try {
			const googleDoc: docs_v1.Schema$Document = await this.resolveDocument(documentId);
			const requests: docs_v1.Schema$Request[] = [];

			_keys(updates).forEach(param => {
				const update = updates[param];
				const parameterString = `{{${param}}`;
				const placeholderLocation = this.findPlaceholder(googleDoc, parameterString);

				if (!placeholderLocation) {
					return this.logWarning(`cannot find param ${parameterString} in the document`);
				}

				this.logError(placeholderLocation)
				switch (update.type) {
					case UpdateType_Text:
						requests.push(this.replaceTextRequest(param as string, update.content));
						break;
					case UpdateType_List:
						requests.push(...this.replaceListRequest(placeholderLocation, update.items));
						break;
					case UpdateType_Table:
						requests.push(...this.replaceTableRequest(placeholderLocation, update.headers, update.rows));
				}
			});

			return (await this.googleDocs.documents.batchUpdate({
				requestBody: {requests: requests},
				documentId: documentId
			})).data;
		} catch (err: any) {
			throw this.handleError(err);
		}
	};

	//######################### Document Manipulation #########################

	/**
	 * Generate a request to replace text in a placeholder.
	 */
	private replaceTextRequest = (param: string, newText: string) => ({
		replaceAllText: {
			containsText: {
				text: `{{${param}}}`,
				matchCase: true,
			},
			replaceText: newText,
		},
	});

	/**
	 * Generate Google Docs requests to insert a list at the placeholder location.
	 */
	private replaceListRequest = (location: GoogleDocs_ParamRange, items: string[]) => {
		const requests: docs_v1.Schema$Request[] = [];

		// Delete the placeholder first
		requests.push({
			deleteContentRange: {
				range: {
					startIndex: location.startIndex,
					endIndex: location.endIndex,
				},
			},
		});

		// Insert the list items
		items.forEach((item, index) => {
			requests.push({
				insertText: {
					text: item + '\n',
					location: {index: location.startIndex + index},
				},
			});
			requests.push({
				createParagraphBullets: {
					range: {
						startIndex: location.startIndex + index,
						endIndex: location.startIndex + index + item.length,
					},
					bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
				},
			});
		});

		return requests;
	};

	/**
	 * Generate a Google Docs request to insert a table at the placeholder location.
	 */
	private replaceTableRequest = (location: GoogleDocs_ParamRange, headers: string[], rows: string[][]) => {
		const requests: docs_v1.Schema$Request[] = [];

		requests.push({
			insertTable: {
				rows: rows.length + 1, // +1 for the headers row
				columns: headers.length,
				location: {
					index: location.startIndex,
				},
			},
		});

		headers.forEach((header, columnIndex) => {
			requests.push({
				insertText: {
					text: header,
					location: {
						index: location.startIndex + columnIndex, // Adjust index for column placement
					},
				},
			});
		});

		rows.forEach((row, rowIndex) => {
			row.forEach((cellText, columnIndex) => {
				requests.push({
					insertText: {
						text: cellText,
						location: {
							index: location.startIndex + headers.length + (rowIndex * headers.length) + columnIndex,
						},
					},
				});
			});
		});

		return requests;
	};
}

export const ModuleBE_GoogleDocs = new ModuleBE_GoogleDocs_Class();