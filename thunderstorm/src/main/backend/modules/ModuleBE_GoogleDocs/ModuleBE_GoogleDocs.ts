import {MissingPermissionException, Module} from '@nu-art/ts-common';
import {GoogleAuth, OAuth2Client} from 'google-auth-library';
import {docs_v1, drive_v3, google} from 'googleapis';
import {Key_GoogleDocsServiceAccount} from './consts';
import {ModuleBE_Auth} from '@nu-art/google-services/backend';
import {ModuleBE_SecretManager} from '@nu-art/google-services/backend/modules/ModuleBE_SecretManager';
import {Storm} from '../../core/Storm';
import {GoogleDocUpdateRequest} from './types';

type Config = {
	scopes: string[],
	secretName: string
}

const textList = [
	'kaki',
	'maki',
	'paki'
];

class ModuleBE_GoogleDocs_Class
	extends Module<Config> {

	private googleDrive!: drive_v3.Drive;
	private googleDocs!: docs_v1.Docs;

	constructor() {
		super('ModuleBE_GoogleDocs');
	}

	//######################### Setup #########################

	protected async init() {
		super.init();
		const authClient = await this.getGoogleAuthClient();
		this.googleDrive = google.drive({version: 'v3', auth: authClient});
		this.googleDocs = google.docs({version: 'v1', auth: authClient});

		await this.updateDocumentById('1_za5MZLbKvfXzg_8IZElTTEF2bnx_kwd4owuslbWemo', [
			{
				replaceAllText: {
					containsText: {text: `{{ani param}}`, matchCase: true},
					replaceText: 'ani hamachlif shel haparam',
				}
			},
			{
				insertText: {
					location: {index: 1},
					text: textList.join('\n')
				}
			},
			{
				createParagraphBullets: {
					range: {
						startIndex: 1,
						endIndex: textList.join('\n').length + 1,
					},
					bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
				},
			}
		]);
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

	private resolveFileById = async (id: string) => {
		return this.googleDocs.documents.get({documentId: id});
	};

	//######################### Document Manipulation #########################

	//TODO: Implement
	public updateDocumentById = async (id: string, requests: GoogleDocUpdateRequest[]) => {
		return this.googleDocs.documents.batchUpdate({
			requestBody: {
				requests: requests
			},
			documentId: id
		});
	};
}

export const ModuleBE_GoogleDocs = new ModuleBE_GoogleDocs_Class();