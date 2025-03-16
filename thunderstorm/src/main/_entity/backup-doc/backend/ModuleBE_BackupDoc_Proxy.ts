import {ApiException, BadImplementationException, exists, LogLevel, Module, TypedMap} from '@nu-art/ts-common';
import {DBApiConfigV3} from '../../../backend/modules/db-api-gen/ModuleBE_BaseDB';
import {Readable} from 'stream';
import {DBProto_BackupDoc, FetchBackupDoc} from '../shared/types';
import {Request_GetMetadata, Response_BackupDocs} from '../shared/api-def';
import {ApiDef, HttpMethod, QueryApi, TypedApi} from '../../../shared';
import {AxiosHttpModule, AxiosHttpRequest} from '../../../backend';
import {CSVModuleV3} from '@nu-art/ts-common/modules/CSVModuleV3';
import {HttpCodes} from '@nu-art/ts-common/core/exceptions/http-codes';

type EnvConfig = {
	key: string
	baseUrl: string
	headers: TypedMap<string | string[]>
}

type Config = DBApiConfigV3<DBProto_BackupDoc> & {
	envs: EnvConfig[]
}


export class ModuleBE_BackupDoc_Proxy_Class
	extends Module<Config> {

	constructor() {
		super();
		this.setMinLevel(LogLevel.Verbose);
	}

	protected init(): void {
		super.init();
	}

	private createBaseRequest<Api extends TypedApi<any, any, any, any, any>>(envKey: string, method: ApiDef<Api>["method"], relativeRoute: string): AxiosHttpRequest<Api> {
		const envConfig = this.config.envs.find(env => env.key === envKey);

		if (!exists(envConfig))
			throw new BadImplementationException(`Did not provide an env config for key: "${envKey}"!`);

		const outputDef: ApiDef<Api> = {
			method: method,
			path: '',
			fullUrl: `${envConfig.baseUrl}${relativeRoute}`
		};

		return AxiosHttpModule
			.createRequest(outputDef)
			.addHeaders(envConfig.headers);

	}

	async getBackupInfo(queryParams: Request_GetMetadata) {
		const envConfig = this.config.envs.find(env => env.key === queryParams.env);

		if (!exists(envConfig))
			throw new BadImplementationException(`Did not receive env in the fetch from env api call!`);

		const response: Response_BackupDocs = await this.createBaseRequest(queryParams.env, HttpMethod.GET, "/v1/fetch-backup-docs-v2")
			.setUrlParams({backupId: queryParams.backupId})
			.addHeaders(envConfig.headers)
			.executeSync();

		const backupInfo = response.backupInfo;

		if (!backupInfo)
			throw HttpCodes._4XX.ENTITY_DOESNT_EXISTS(`No backup for id: "${queryParams.backupId}"`);

		if (!backupInfo.metadata)
			throw HttpCodes._4XX.ENTITY_DOESNT_EXISTS(`No metadata in backup with id: "${queryParams.backupId}"`);

		if (backupInfo?._id !== queryParams.backupId)
			throw HttpCodes._4XX.CONFLICT(`Received backup descriptors with wrong backupId! provided id: ${queryParams.backupId} received id: ${backupInfo?._id}`);

		return backupInfo;
	}

	getBackupStreamFromId = async (backupInfo: FetchBackupDoc) => {
		if (!backupInfo.backupFilePath)
			throw new ApiException(404, 'Backup file path not found');

		this.logInfo(`----  Fetching Backup Stream from: ${backupInfo.firestoreSignedUrl} ----`);
		const signedUrlDef: ApiDef<QueryApi<any>> = {
			method: HttpMethod.GET,
			path: '',
			fullUrl: backupInfo.firestoreSignedUrl
		};

		return (await AxiosHttpModule
			.createRequest(signedUrlDef)
			.setResponseType('stream')
			.executeSync()) as Readable;
	};

	createBackupReadStream = async (backupInfo: FetchBackupDoc): Promise<Readable> => {
		const stream = await this.getBackupStreamFromId(backupInfo);
		const transformer = CSVModuleV3.provideFormatterFromCsv();
		return stream.pipe(transformer);
	};
}

export const ModuleBE_BackupDoc_Proxy = new ModuleBE_BackupDoc_Proxy_Class();
