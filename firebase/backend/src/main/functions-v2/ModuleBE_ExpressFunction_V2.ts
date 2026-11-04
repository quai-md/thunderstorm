import {ModuleBE_BaseFunction} from './ModuleBE_BaseFunction.js';
import {addItemToArray} from '@nu-art/ts-common';
import express, {Express} from 'express';
import {HttpsFunction, HttpsOptions, onRequest} from 'firebase-functions/v2/https';
import {listenOnPort} from './listen-on-port.js';


export class ModuleBE_ExpressFunction_V2<Config = {}>
	extends ModuleBE_BaseFunction<{ options: HttpsOptions } & Config> {
	private function!: HttpsFunction;
	private expressApp!: Express;

	protected constructor(name: string = 'api') {
		super(name);
	}

	serve = (port: number) => {
		this.getFunction();
		return listenOnPort(this.expressApp, port);
	};

	getFunction = () => {
		if (this.function)
			return this.function;
		this.expressApp = express();
		const realFunction = this.createFunction(this.expressApp);
		return this.function = onRequest(this.config.options, (req, res) => {
			if (this.isReady) { // @ts-ignore
				return realFunction(req, res);
			}

			return new Promise((resolve) => {
				// @ts-ignore
				addItemToArray(this.toBeExecuted, () => realFunction(req, res));
				this.toBeResolved = resolve;
			});
		});
	};

	protected createFunction(_express: Express) {
		return onRequest(this.config.options, _express);
	}
}