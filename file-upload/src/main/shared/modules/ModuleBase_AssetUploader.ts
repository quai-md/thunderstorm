/*
 * Permissions management system, define access level for each of
 * your server apis, and restrict users by giving them access levels
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
import {__stringify, _keys, BadImplementationException, Dispatcher, generateHex, Module, Queue} from '@nu-art/ts-common';
import {ApiDefCaller, BaseHttpModule_Class} from '@nu-art/thunderstorm';

import {
	ApiStruct_AssetUploader,
	BaseUploaderFile,
	FileInfo,
	FileStatus,
	FileUploadResult,
	OnFileStatusChanged,
	Push_FileUploaded,
	PushKey_FileUploaded,
	Request_Uploader,
	TempSecureUrl
} from '../../shared';
import {OnPushMessageReceived} from '@nu-art/push-pub-sub/frontend';
import {DB_Notifications} from '@nu-art/push-pub-sub';


export type FilesToUpload = Request_Uploader & {
	// Unfortunately be doesn't know File and File doesn't map to ArrayBuffer
	file: any
}

export type UploaderConfig = {
	manualProcessTriggering: boolean
	uploadQueueParallelCount?: number
}

export abstract class ModuleBase_AssetUploader<HttpModule extends BaseHttpModule_Class, Config extends UploaderConfig = UploaderConfig>
	extends Module<Config>
	implements OnPushMessageReceived<Push_FileUploaded> {

	protected vv1!: ApiDefCaller<ApiStruct_AssetUploader>['vv1'];

	protected files: { [id: string]: FileInfo } = {};
	private readonly uploadQueue: Queue = new Queue('File Uploader').setParallelCount(1);
	protected readonly dispatch_fileStatusChange = new Dispatcher<OnFileStatusChanged, '__onFileStatusChanged'>('__onFileStatusChanged');

	protected constructor() {
		super();
		this.setDefaultConfig({manualProcessTriggering: false} as Partial<Config>);
	}

	__onMessageReceived(notification: DB_Notifications<FileUploadResult>): void {
		if (notification.pushKey !== PushKey_FileUploaded)
			return;

		const data = notification.data;
		if (!data)
			return this.logError('file upload push without data');

		const feId = data.asset.feId;
		if (!feId)
			return this.logError('file upload push without feId');

		this.setFileInfo(feId, data);
	}

	init() {
		if (this.config.uploadQueueParallelCount)
			this.uploadQueue.setParallelCount(this.config.uploadQueueParallelCount);
	}

	protected abstract subscribeToPush(toSubscribe: TempSecureUrl[]): Promise<void>

	getFileInfo<K extends keyof FileInfo>(id: string, key: K): FileInfo[K] | undefined {
		return this.files[id] && this.files[id][key];
	}

	getFullFileInfo(id?: string): FileInfo | undefined {
		if (!id)
			return undefined;

		return this.files[id];
	}

	protected setFileInfo<K extends keyof FileInfo>(feId: string, values: Partial<FileInfo>) {
		const fileInfo = this.files[feId];
		if (!fileInfo)
			return this.logError(`file upload push received, but no file info exists for ${feId}`);

		_keys(values).forEach(key => fileInfo[key] = values[key]);
		this.dispatchFileStatusChange(feId);
	}

	protected dispatchFileStatusChange(id: string) {
		this.dispatch_fileStatusChange.dispatchModule(id);
	}

	uploadImpl(files: FilesToUpload[]): BaseUploaderFile[] {
		const body: BaseUploaderFile[] = files.map(fileData => {
			const fileInfo: BaseUploaderFile = {
				name: fileData.name,
				mimeType: fileData.mimeType,
				feId: generateHex(32)
			};

			if (fileData.key)
				fileInfo.key = fileData.key;

			if (fileData.public)
				fileInfo.public = fileData.public;

			this.files[fileInfo.feId] = {
				file: fileData.file,
				status: FileStatus.ObtainingUrl,
				name: fileData.name
			};

			return fileInfo;
		});

		this.vv1.getUploadUrl?.(body)
			.execute(async (response: TempSecureUrl[]) => {
				body.forEach(f => this.setFileInfo(f.feId, {status: FileStatus.UrlObtained}));
				if (!response)
					return;

				// Not a relevant await but still...
				await this.uploadFiles(response);
			});

		return body;
	}

	private uploadFiles = async (response: TempSecureUrl[]) => {
		// Subscribe
		await this.subscribeToPush(response);

		response.forEach(r => {
			const feId = r.asset.feId;
			this.uploadQueue.addItem(async () => {
				await this.uploadFile(r);
				delete this.files[feId].file;
				this.setFileInfo(feId, {progress: 0});
				//TODO: Probably need to set a timer here in case we dont get a push back (contingency)
			}, () => {
				this.setFileInfo(feId, {status: FileStatus.WaitingForProcessing});
				if (this.config.manualProcessTriggering)
					this.processAssetManually(feId);
			}, error => {
				this.setFileInfo(feId, {
					messageStatus: __stringify(error),
					status: FileStatus.Error
				});
			});
		});
	};

	private uploadFile = async (response: TempSecureUrl) => {
		const feId = response.asset.feId;
		this.setFileInfo(feId, {
			status: FileStatus.UploadingFile,
			asset: response.asset
		});

		const fileInfo = this.files[feId];
		if (!fileInfo)
			throw new BadImplementationException(`Missing file with id ${feId} and name: ${response.asset.name}`);

		const request = this.vv1.uploadFile(fileInfo.file, undefined as never)
			.setUrl(response.securedUrl);
		// const request = this
		// 	.httpModule
		// 	.createRequest(HttpMethod.PUT, RequestKey_UploadFile, feId)
		// 	.setUrl(response.secureUrl)
		// 	.setHeader('Content-Type', response.asset.mimeType)
		// 	.setTimeout(20 * Minute)
		// 	.setBody(fileInfo.file)
		// 	.setOnProgressListener((ev: TS_Progress) => {
		// 		this.setFileInfo(feId, {progress: ev.loaded / ev.total});
		// 	});

		fileInfo.request = request;
		await request.executeSync();
	};

	processAssetManually = (feId?: string) => {
		const request = this.vv1.processAssetManually({feId});

		// const request = this
		// 	.httpModule
		// 	.createRequest<Api_ProcessAssetManually>(HttpMethod.GET, RequestKey_ProcessAssetManually, feId)
		// 	.setRelativeUrl('v1/upload/process-asset-manually');

		if (feId)
			request.setUrlParam('feId', feId);

		request.execute();
	};
}



