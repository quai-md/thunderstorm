import {Logger, Module, removeItemFromArray, TypedMap} from '@nu-art/ts-common';


export const Key_UndefinedMessage = 'undefined-message';

/**
 * Subset of interface Window, which contains postMessage functions
 */
interface Messagable {
	postMessage(message: any, targetOrigin: string, transfer?: Transferable[]): void;

	postMessage(message: any, options?: WindowPostMessageOptions): void;
}

export type Message = {
	key: string
}

type PendingWindowMessage = {
	origin: string;
	data: unknown;
};

class ModuleFE_WindowMessenger_Class
	extends Module {

	//######################### Static #########################

	readonly receivers: BaseReceiver<any>[] = [];
	private readonly pendingMessages: PendingWindowMessage[] = [];
	private listener?: (event: MessageEvent) => void;

	constructor() {
		super();
		// postMessage is not queued. Listen at load so a message that arrives before mount is kept.
		this.installEarlyListener();
	}

	//######################### Life Cycle #########################

	addReceiver(receiver: BaseReceiver<any>) {
		if (this.receivers.includes(receiver))
			return;

		this.receivers.push(receiver);
		this.flushPending();
	}

	removeReceiver(receiver: BaseReceiver<any>) {
		removeItemFromArray(this.receivers, receiver);
	}

	private installEarlyListener() {
		if (this.listener)
			return;

		const host = globalThis.window;
		if (!host)
			return;

		this.listener = this.onMessage;
		host.addEventListener('message', this.listener);
	}

	private readonly onMessage = (event: MessageEvent) => {
		const buffered = this.receivers.length === 0;
		this.reportWindowMessage(buffered, event.origin, event.data);

		if (buffered) {
			this.pendingMessages.push({origin: event.origin, data: event.data});
			return;
		}

		this.dispatch(event.origin, event.data);
	};

	private flushPending() {
		if (this.receivers.length === 0 || this.pendingMessages.length === 0)
			return;

		const pending = this.pendingMessages.splice(0);
		pending.forEach(message => this.dispatch(message.origin, message.data));
	}

	private reportWindowMessage(buffered: boolean, origin: string, data: unknown) {
		const marker = `window-message buffered=${buffered} origin=${origin} keys=${this.messageKeys(data)}`;
		console.log(marker);
		this.logInfo(marker);
	}

	private messageKeys(data: unknown): string {
		if (data === null || typeof data !== 'object')
			return typeof data;

		const keys = Object.keys(data).sort();
		if (keys.length === 0)
			return typeof data;

		return keys.join(',');
	}

	private dispatch(origin: string, data: unknown) {
		this.receivers.forEach(receiver => receiver.execute(origin, data));
	}

	sendMessage<T extends Message>(message: T, target: Messagable) {
		target.postMessage(message, '*');
	}

	createMessenger<T extends Message>(target: Messagable) {
		return new Messenger<T>(target);
	}

	createReceiver<T extends Message>(origin?: string, transformer?: (data: any) => T[]) {
		return new Receiver(origin, transformer);
	}

	createRawReceiver(execute: (message: any) => void, origin?: string) {
		return new RawReceiver(execute, origin);
	}
}

export const ModuleFE_WindowMessenger = new ModuleFE_WindowMessenger_Class();

//Message Sender

export class Messenger<T extends Message> {
	readonly target: Messagable;

	constructor(target: Messagable) {
		this.target = target;
	}

	sendMessage(message: T) {
		ModuleFE_WindowMessenger.sendMessage(message, this.target);
	}
}

//Message Receiver

export abstract class BaseReceiver<T = any>
	extends Logger {

	readonly origin: string;
	private readonly regex: RegExp;
	private filter: (message: any) => boolean = (message: any) => true;

	constructor(origin = '.*') {
		super();
		this.setTag(`Receiver (${origin})`);
		this.origin = origin;
		this.regex = new RegExp(origin);
	}

	mount() {
		ModuleFE_WindowMessenger.addReceiver(this);
		return this;
	}

	unmount() {
		ModuleFE_WindowMessenger.removeReceiver(this);
		return this;
	}

	readonly execute = (origin: string, message: T) => {
		if (!this.regex.test(origin))
			return;

		if (!this.filter(message))
			return;

		this.executeImpl(message);
	};

	abstract executeImpl(message: T): void

	setFilter(filter: (message: any) => boolean) {
		this.filter = filter;
		return this;
	}
}

export class RawReceiver
	extends BaseReceiver {
	readonly execute: (message: any) => void;

	constructor(execute: (message: any) => void, origin = '.*') {
		super(origin);
		this.execute = execute;
	}

	executeImpl(message: any): void {
		this.execute(message);
	}
}

/**
 * Need to add a processor per each key prop's value that can be returned in the transformer output.
 */
export class Receiver<T extends Message>
	extends BaseReceiver {

	private readonly messageProcessorMap: TypedMap<(message: any) => void> = {};
	private readonly transform: (data: any) => T[]; // Receives one window message, returns array with 1 or more transformed messages., each message needs prop 'key' with a matching processor added.
	private defaultProcessor?: (transformedMessage: T, message: any) => void;

	/**
	 *
	 * @param origin window.origin
	 * @param transform Receives the MessageEvent and needs to transform it into an array of objects, each having prop "key". To each potential "key", you need to add an appropriate processor.
	 */
	constructor(origin = '.*', transform: (data: any) => T[] = data => [data] as T[]) {
		super();
		this.setTag(`Receiver (${origin})`);
		this.transform = transform;
	}

	setDefaultProcessor(processor: (transformedMessage: T, message: any) => void) {
		this.defaultProcessor = processor;
		return this;
	}

	addProcessor<K extends T>(key: K['key'], processor: (message: K) => void) {
		this.messageProcessorMap[key] = processor;
		return this;
	}

	removeProcessor<K extends T>(key: K['key']) {
		delete this.messageProcessorMap[key];
		return this;
	}

	executeImpl(message: any) {
		const transformedMessages = this.transform(message);
		transformedMessages.forEach(_transformedMessage => {
			const processor = this.messageProcessorMap[_transformedMessage.key];
			if (processor) {
				processor(_transformedMessage);
				return;
			}

			this.logDebug(`No message processor defined for key ${message.key}`);
			this.defaultProcessor?.(_transformedMessage, message);
			return;
		});
	}
}