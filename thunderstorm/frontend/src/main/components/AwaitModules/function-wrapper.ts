import {exists, Logger, ResolvableContent, resolveContent, RuntimeModules} from '@nu-art/ts-common';
import {ModuleFE_BaseDB} from '../../modules/db-api-gen/ModuleFE_BaseDB.js';
import {DataStatus} from '../../core/db-api-gen/consts.js';
import {Thunder} from '../../core/Thunder.js';

type PendingCall<T, Args extends any[]> = {
	args: Args;
	resolve: (v: T) => void;
	reject: (e: any) => void;
};

export class AwaitModules_FunctionWrapper<T, Args extends any[] = []>
	extends Logger {
	private modules: ModuleFE_BaseDB<any, any>[];
	private callback: (...args: Args) => T;
	private readyState: boolean;
	private pending: PendingCall<T, Args>[] = [];
	private listening = false;

	//######################### Life Cycle #########################

	__onSyncStatusChanged(module: ModuleFE_BaseDB<any, any>): void {
		this.logVerbose(`__onSyncStatusChanged: ${module.getCollectionName()}`);
		if (!this.modules.includes(module))
			return;

		this.tryResolvePending();
	}

	constructor(modules: ResolvableContent<ModuleFE_BaseDB<any, any>[]>, callback: (...args: Args) => T) {
		super();
		const runtimeModules = RuntimeModules();
		this.callback = callback;
		this.readyState = false;
		this.modules = resolveContent(modules).filter(m => {
			if (!runtimeModules.includes(m)) {
				this.logWarning(`Got module ${m.getName()}, but it isn't in RuntimeModules!`);
				return false;
			}
			if (!exists(m.dbDef)) {
				this.logWarning(`Got module ${m.getName()}, but it doesn't have a dbDef!`);
				return false;
			}

			return true;
		});
	}

	//######################### Internal logic #########################

	private isReady = (): boolean => {
		if (this.readyState)
			return true;

		const ready = this.modules.every(m => m.getDataStatus() === DataStatus.ContainsData);
		if (ready)
			this.readyState = true;

		return this.readyState;
	};

	private attachListener = () => {
		if (this.listening)
			return;
		// @ts-ignore
		Thunder.getInstance().addUIListener(this);
		this.listening = true;
	};

	private detachListener = () => {
		if (!this.listening)
			return;
		// @ts-ignore
		Thunder.getInstance().removeUIListener(this);
		this.listening = false;
	};

	private tryResolvePending = () => {
		if (!this.isReady() || this.pending.length === 0)
			return;

		//Modules are ready, detach the listener and flush all waiters with their own args
		this.detachListener();
		const waiters = this.pending;
		this.pending = [];

		for (const waiter of waiters) {
			try {
				waiter.resolve(this.callback(...waiter.args));
			} catch (e) {
				waiter.reject(e);
			}
		}
	};

	//######################### Public Interface #########################

	public execute = (...args: Args): Promise<T> => {
		if (this.isReady())
			return new Promise<T>((resolve, reject) => {
				try {
					resolve(this.callback(...args));
				} catch (e) {
					reject(e);
				}
			});

		return new Promise<T>((resolve, reject) => {
			this.pending.push({args, resolve, reject});
			this.attachListener();
		});
	};
}