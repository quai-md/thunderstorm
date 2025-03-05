import {
	__stringify,
	BadImplementationException,
	Module,
	ThisShouldNotHappenException,
	TypedMap
} from '@nu-art/ts-common';

import {OpenAI} from 'openai';
import {addRoutes, createBodyServerApi} from '@nu-art/thunderstorm/backend';
import {ApiDef_OpenAI, Request_ChatGPT} from '../../shared/api-def';
import fs from 'fs';

type GPT_Model = 'gpt-4'
	| 'gpt-4-0314'
	| 'gpt-4-0613'
	| 'gpt-4-32k'
	| 'gpt-4-32k-0314'
	| 'gpt-4-32k-0613'
	| 'gpt-3.5-turbo'
	| 'gpt-3.5-turbo-16k'
	| 'gpt-3.5-turbo-0301'
	| 'gpt-3.5-turbo-0613'
	| 'gpt-3.5-turbo-16k-0613'

type Config = {
	directives: TypedMap<{
		agent?: GPT_Model,
		directive: string
	}>
	defaultModel: GPT_Model
	apiKey: string
	orgId?: string
// config here
}

// const config: Config = {
// 	directives: {
// 		'address-resolver': 'You are a Typescript address resolving assistant, you return a JSON with the following props: city, streetName, houseNumber, entrance (single letter), floor, apartmentNumber, country and additionalInfo. The JSON props must remain in english whereas the values need to be translated to valid addresses in Hebrew. unavailable props should be omitted from the JSON\'s props',
// 	},
// 	defaultModel: 'gpt-4',
// 	apiKey: 'YourAPI-Key',
// 	orgId: 'YourORG-Id'
// };
type Request_PredefiedDirective = {
	directiveKey: string,
	message: string
	model?: GPT_Model
};

type Request_UploadFile = {
	filePath: string,
}

type Request_QueryWithAssistant = {
	assistantId: string,
	threadId: string,
	userMessage: string,
	fileId?: string
}

export class ModuleBE_OpenAI_Class
	extends Module<Config> {

	private openai!: OpenAI;

	constructor(tag?: string) {
		super(tag);
	}

	init() {
		const apiKey = this.config.apiKey;
		const organization = this.config.orgId;
		const opts = {apiKey, organization};
		this.logInfo(opts);
		this.openai = new OpenAI(opts);

		addRoutes([
			createBodyServerApi(ApiDef_OpenAI.v1.test, this.test),
		]);
	}

	test = async (query: Request_ChatGPT) => this.simpleQuery(query);

	predefinedQuery = async (query: Request_PredefiedDirective) => {
		const directive = this.config.directives[query.directiveKey];
		if (!directive)
			throw new BadImplementationException(`Missing instruction for directive: ${query.directiveKey}`);

		return this.simpleQuery({
			model: directive.agent ?? query.model,
			message: query.message,
			directive: directive.directive
		});
	};

	simpleQuery = async (query: Request_ChatGPT) => {
		const completion = await this.openai.chat.completions.create({
			messages: [
				{
					role: 'system',
					content: query.directive
				},
				{
					role: 'user',
					content: query.message
				}
			],
			model: query.model || this.config.defaultModel || 'gpt-3.5-turbo',
		});

		const content = completion.choices[0].message.content;
		this.logInfo(completion);
		if (!content)
			throw new ThisShouldNotHappenException(`Didn't receive a response from GPT, got: ${__stringify(completion, true)}`);

		return {response: content};
	};

	createAssistant = async (instructions: string, assistantName: string) => {
		return this.openai.beta.assistants.create({
			name: assistantName,
			instructions: instructions,
			model: this.config.defaultModel ?? 'gpt-4'
		});
	};

	/**
	 * Uploads a file to OpenAI's Assistants API and returns the file ID.
	 */
	uploadFileToAssistant = async (query: Request_UploadFile) => {
		const file = fs.createReadStream(query.filePath);
		const fileUpload = await this.openai.files.create({
			file: file,
			purpose: 'assistants',
		});

		this.logInfo(`File uploaded successfully. File ID: ${fileUpload.id}`);
		return {fileId: fileUpload.id};
	};

	createAThread = async () => {
		return (await this.openai.beta.threads.create()).id;
	};

	/**
	 * Sends a query to OpenAI's Assistant with a directive, message, and optional file ID.
	 */
	queryWithAssistant = async (query: Request_QueryWithAssistant) => {

		// Add user message
		await this.openai.beta.threads.messages.create(query.threadId, {
			role: 'user',
			content: query.userMessage,
			attachments: query.fileId ? [{file_id: query.fileId, tools: [{type: 'code_interpreter'}]}] : [],
		});

		// ✅ Start a run (actually processes the request)
		const run = await this.openai.beta.threads.runs.create(query.threadId, {
			assistant_id: query.assistantId,
		});

		// ✅ Wait for completion (polling)
		let runStatus = run.status;
		while (runStatus === 'queued' || runStatus === 'in_progress'  || runStatus === "requires_action") {
			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
			const updatedRun = await this.openai.beta.threads.runs.retrieve(query.threadId, run.id);
			runStatus = updatedRun.status;
		}

		// ✅ Get the assistant's response from the thread
		const messages = await this.openai.beta.threads.messages.list(query.threadId);
		const assistantMessage = messages.data.filter((msg) => msg.role === 'assistant');

		this.logInfo(runStatus);
		this.logInfo(assistantMessage);
		// @ts-ignore
		const responseText = assistantMessage[0]?.content[0]?.text?.value || 'No response received';

		this.logInfo(responseText);
		return {response: responseText};
	};
}

export const ModuleBE_OpenAI = new ModuleBE_OpenAI_Class();