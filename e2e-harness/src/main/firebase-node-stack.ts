/*
 * @nu-art/e2e-harness - Node backend + Firebase data emulators
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

import {spawn, execSync, type ChildProcess} from 'node:child_process';
import {cpSync, existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {E2EHarnessOwnedResources} from './types.js';

type JsonObject = {[key: string]: JsonValue};
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export type QuaiAppLayout = {
	label: string;
	repoRoot: string;
	backendDirName: string;
	frontendDirName: string;
};

export type QuaiNodeStackConfig = {
	label: string;
	projectId: string;
	backendRoot: string;
	frontendRoot: string;
	repoRoot: string;
	nodePort: number;
	frontendPort: number;
	frontendKey: string;
	frontendOrigin: string;
	backendOrigin: string;
	sslKey: string;
	sslCert: string;
	webServerCommand: string;
};

type EmulatorPorts = {
	database: number;
	firestore: number;
	firestoreWebsocket: number;
	pubsub: number;
	storage: number;
	auth: number;
	hub?: number;
	logging?: number;
};

/** Read ports, project id, and the frontend start command from the app packages. */
export function resolveQuaiStackConfig(layout: QuaiAppLayout): QuaiNodeStackConfig {
	const backendRoot = resolve(layout.repoRoot, layout.backendDirName);
	const frontendRoot = resolve(layout.repoRoot, layout.frontendDirName);
	const backendPackage = readPackageJson(resolve(backendRoot, '__package.json'));
	const frontendPackage = readPackageJson(resolve(frontendRoot, '__package.json'));
	const backendUnit = unitConfig(backendPackage, backendRoot);
	const frontendUnit = unitConfig(frontendPackage, frontendRoot);
	const nodePort = requiredNumber(backendUnit.basePort, `${backendRoot}/__package.json unitConfig.basePort`);
	const frontendPort = requiredNumber(frontendUnit.servingPort, `${frontendRoot}/__package.json unitConfig.servingPort`);
	const projectId = requiredString(backendUnit.envs?.local?.projectId, `${backendRoot}/__package.json unitConfig.envs.local.projectId`);
	const configUrl = requiredString(frontendUnit.envs?.local?.config?.configUrl, `${frontendRoot}/__package.json unitConfig.envs.local.config.configUrl`);
	const frontendKey = frontendKeyFromConfigUrl(configUrl);
	const sslKey = resolve(backendRoot, requiredString(backendUnit.sslKey, `${backendRoot}/__package.json unitConfig.sslKey`));
	const sslCert = resolve(backendRoot, requiredString(backendUnit.sslCert, `${backendRoot}/__package.json unitConfig.sslCert`));
	const start = requiredString(frontendPackage.scripts?.start, `${frontendRoot}/__package.json scripts.start`);
	const webpackBin = resolve(frontendRoot, 'node_modules/.bin/webpack-dev-server');
	const webServerCommand = start
		.replaceAll('{{__ENV__}}', 'local')
		.replaceAll(' --open', '')
		.replace('webpack-dev-server', webpackBin);

	return {
		label: layout.label,
		projectId,
		backendRoot,
		frontendRoot,
		repoRoot: layout.repoRoot,
		nodePort,
		frontendPort,
		frontendKey,
		frontendOrigin: `https://localhost:${frontendPort}`,
		backendOrigin: `https://localhost:${nodePort}`,
		sslKey,
		sslCert,
		webServerCommand,
	};
}

/**
 * Start Firebase data emulators and `node dist/index.js`.
 * The functions emulator is not started. A busy port prints `lsof` and throws.
 */
export async function startQuaiNodeStack(config: QuaiNodeStackConfig): Promise<E2EHarnessOwnedResources> {
	const stack = new QuaiNodeStack(config);
	return stack.start();
}

export function patchQuaiEmulatorData(data: JsonObject, config: QuaiNodeStackConfig, databasePort: number): void {
	const rootConfig = asObject(data._config, '_config');
	const local = asObject(rootConfig.local, '_config.local');
	const httpServer = asObject(local.HttpServer ??= {}, '_config.local.HttpServer');
	httpServer.port = config.nodePort;
	httpServer.ssl = {key: config.sslKey, cert: config.sslCert};

	const cors = asObject(httpServer.cors ??= {}, '_config.local.HttpServer.cors');
	const origins = stringArray(cors.origins ??= [], '_config.local.HttpServer.cors.origins');
	for (const origin of [config.frontendOrigin, config.backendOrigin, `https://127.0.0.1:${config.frontendPort}`, `https://127.0.0.1:${config.nodePort}`]) {
		if (!origins.includes(origin))
			origins.push(origin);
	}

	const frontend = asObject(data._frontend, '_frontend');
	const frontendLayer = asObject(frontend[config.frontendKey], `_frontend.${config.frontendKey}`);
	const xhr = asObject(frontendLayer.ModuleFE_XHR ??= {}, `_frontend.${config.frontendKey}.ModuleFE_XHR`);
	xhr.origin = config.backendOrigin;

	const listener = asObject(frontendLayer.ModuleFE_FirebaseListener ??= {}, `_frontend.${config.frontendKey}.ModuleFE_FirebaseListener`);
	const firebaseConfig = asObject(listener.firebaseConfig ??= {}, `_frontend.${config.frontendKey}.ModuleFE_FirebaseListener.firebaseConfig`);
	firebaseConfig.databaseURL = `http://127.0.0.1:${databasePort}?ns=${config.projectId}`;
	const emulatorConfig = asObject(listener.emulatorConfig ??= {}, `_frontend.${config.frontendKey}.ModuleFE_FirebaseListener.emulatorConfig`);
	emulatorConfig.hostname = '127.0.0.1';
	emulatorConfig.port = databasePort;
}

class QuaiNodeStack {
	private firebase: ChildProcess | undefined;
	private backend: ChildProcess | undefined;
	private readonly config: QuaiNodeStackConfig;

	constructor(config: QuaiNodeStackConfig) {
		this.config = config;
	}

	async start(): Promise<E2EHarnessOwnedResources> {
		const ports = this.readEmulatorPorts();
		this.assertRequiredFiles(ports);
		for (const port of this.portsToOwn(ports))
			assertPortFree(port);

		const importPath = this.prepareEmulatorImport(ports.database);
		this.firebase = await this.startFirebase(importPath);
		this.backend = this.startBackend(ports);
		return {teardown: () => this.stop()};
	}

	async stop(): Promise<void> {
		killProcess(this.backend);
		killProcess(this.firebase);
		this.backend = undefined;
		this.firebase = undefined;
	}

	private assertRequiredFiles(ports: EmulatorPorts): void {
		const backendEntry = resolve(this.config.backendRoot, 'dist/index.js');
		const seed = resolve(this.config.backendRoot, '.trash/data');
		const firebaseJson = resolve(this.config.backendRoot, 'firebase.json');
		const firebaseBin = resolve(this.config.repoRoot, 'node_modules/.bin/firebase');
		for (const file of [backendEntry, firebaseJson, firebaseBin, this.config.sslKey, this.config.sslCert]) {
			if (!existsSync(file))
				throw new Error(`${this.config.label} E2E: missing ${file}`);
		}
		if (!existsSync(seed))
			throw new Error(`${this.config.label} E2E: missing emulator export at ${seed}. Run bai --setup for ${this.config.backendRoot}.`);
		if (ports.database === this.config.nodePort)
			throw new Error(`${this.config.label} E2E: node port ${this.config.nodePort} collides with the Realtime Database emulator`);
	}

	private readEmulatorPorts(): EmulatorPorts {
		const firebaseJsonPath = resolve(this.config.backendRoot, 'firebase.json');
		const firebaseJson = readJsonFile(firebaseJsonPath);
		const emulators = asObject(firebaseJson.emulators, `${firebaseJsonPath} emulators`);
		const firestore = asObject(emulators.firestore, `${firebaseJsonPath} emulators.firestore`);
		const hub = emulators.hub;
		const logging = emulators.logging;
		return {
			database: requiredNumber(asObject(emulators.database, 'emulators.database').port, 'emulators.database.port'),
			firestore: requiredNumber(firestore.port, 'emulators.firestore.port'),
			firestoreWebsocket: requiredNumber(firestore.websocketPort, 'emulators.firestore.websocketPort'),
			pubsub: requiredNumber(asObject(emulators.pubsub, 'emulators.pubsub').port, 'emulators.pubsub.port'),
			storage: requiredNumber(asObject(emulators.storage, 'emulators.storage').port, 'emulators.storage.port'),
			auth: requiredNumber(asObject(emulators.auth, 'emulators.auth').port, 'emulators.auth.port'),
			hub: isObject(hub) ? optionalNumber(hub.port) : undefined,
			logging: isObject(logging) ? optionalNumber(logging.port) : undefined,
		};
	}

	private portsToOwn(ports: EmulatorPorts): number[] {
		const owned = [
			this.config.nodePort,
			ports.database,
			ports.firestore,
			ports.firestoreWebsocket,
			ports.pubsub,
			ports.storage,
			ports.auth,
		];
		if (ports.hub !== undefined)
			owned.push(ports.hub);
		if (ports.logging !== undefined)
			owned.push(ports.logging);
		return owned;
	}

	private prepareEmulatorImport(databasePort: number): string {
		const source = resolve(this.config.backendRoot, '.trash/data');
		const destination = resolve(this.config.backendRoot, '.trash/e2e-harness-data');
		rmSync(destination, {recursive: true, force: true});
		cpSync(source, destination, {recursive: true});

		const exportPath = resolve(destination, 'database_export', `${this.config.projectId}.json`);
		if (!existsSync(exportPath))
			throw new Error(`${this.config.label} E2E: missing ${exportPath} inside the emulator export`);

		const data = readJsonFile(exportPath);
		patchQuaiEmulatorData(data, this.config, databasePort);
		writeFileSync(exportPath, JSON.stringify(data));
		return destination;
	}

	private async startFirebase(importPath: string): Promise<ChildProcess> {
		const firebaseBin = resolve(this.config.repoRoot, 'node_modules/.bin/firebase');
		const firebase = spawn(
			firebaseBin,
			[
				'emulators:start',
				'--only', 'database,auth,storage,firestore,pubsub',
				'--project', this.config.projectId,
				'--import', importPath,
				'--export-on-exit', importPath,
			],
			{
				cwd: this.config.backendRoot,
				env: this.childEnv(this.emulatorEnv()),
				stdio: ['ignore', 'pipe', 'pipe'],
			},
		);
		await waitForProcessLog(firebase, /All emulators ready/, `${this.config.label} Firebase emulators`);
		return firebase;
	}

	private startBackend(ports: EmulatorPorts): ChildProcess {
		const backend = spawn('node', [resolve(this.config.backendRoot, 'dist/index.js')], {
			cwd: this.config.backendRoot,
			env: this.childEnv(this.emulatorEnv(ports)),
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		backend.stdout?.on('data', chunk => process.stdout.write(`[${this.config.label}] ${chunk}`));
		backend.stderr?.on('data', chunk => process.stderr.write(`[${this.config.label}] ${chunk}`));
		return backend;
	}

	private emulatorEnv(ports?: EmulatorPorts): NodeJS.ProcessEnv {
		const resolved = ports ?? this.readEmulatorPorts();
		const firebaseConfig = JSON.stringify({
			projectId: this.config.projectId,
			databaseURL: `http://127.0.0.1:${resolved.database}?ns=${this.config.projectId}`,
			storageBucket: `${this.config.projectId}.appspot.com`,
		});
		return {
			...process.env,
			NODE_TLS_REJECT_UNAUTHORIZED: '0',
			GCLOUD_PROJECT: this.config.projectId,
			GOOGLE_CLOUD_PROJECT: this.config.projectId,
			FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${resolved.database}`,
			FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${resolved.auth}`,
			FIRESTORE_EMULATOR_HOST: `127.0.0.1:${resolved.firestore}`,
			FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${resolved.storage}`,
			PUBSUB_EMULATOR_HOST: `127.0.0.1:${resolved.pubsub}`,
			FIREBASE_CONFIG: firebaseConfig,
		};
	}

	private childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
		const copy = {...env};
		delete copy.NODE_OPTIONS;
		return copy;
	}
}

function assertPortFree(port: number): void {
	if (!portHasListener(port))
		return;

	let listeners = '';
	try {
		listeners = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {encoding: 'utf8'}).trim();
	} catch {
		listeners = '(lsof produced no output)';
	}
	throw new Error(`E2E stack: port ${port} is in use. Refusing to kill it.\n${listeners}`);
}

function portHasListener(port: number): boolean {
	try {
		execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

function killProcess(child: ChildProcess | undefined): void {
	if (!child || child.exitCode !== null || child.killed)
		return;
	child.kill('SIGTERM');
}

function waitForProcessLog(child: ChildProcess, pattern: RegExp, label: string): Promise<void> {
	const deadline = Date.now() + 120_000;
	let buffer = '';

	return new Promise((resolvePromise, reject) => {
		const tryResolve = () => {
			if (pattern.test(buffer)) {
				cleanup();
				resolvePromise();
			} else if (Date.now() > deadline) {
				cleanup();
				reject(new Error(`${label} did not become ready within 120s`));
			}
		};

		const onData = (chunk: Buffer) => {
			buffer += chunk.toString();
			tryResolve();
		};

		const onExit = (code: number | null) => {
			if (pattern.test(buffer))
				return;
			cleanup();
			reject(new Error(`${label} exited before ready (code ${code ?? 'unknown'})`));
		};

		const timer = setInterval(tryResolve, 250);
		const cleanup = () => {
			clearInterval(timer);
			child.stdout?.off('data', onData);
			child.stderr?.off('data', onData);
			child.off('exit', onExit);
		};

		child.stdout?.on('data', onData);
		child.stderr?.on('data', onData);
		child.on('exit', onExit);
	});
}

type UnitConfig = {
	basePort?: number;
	servingPort?: number;
	sslKey?: string;
	sslCert?: string;
	envs?: {local?: {projectId?: string; config?: {configUrl?: string}}};
};

type PackageFile = {
	scripts?: {start?: string};
	unitConfig?: UnitConfig;
};

function readPackageJson(path: string): PackageFile {
	const parsed = readJsonFile(path);
	const scripts = isObject(parsed.scripts) ? parsed.scripts : undefined;
	const unit = isObject(parsed.unitConfig) ? parsed.unitConfig : undefined;
	return {
		scripts: scripts ? {start: typeof scripts.start === 'string' ? scripts.start : undefined} : undefined,
		unitConfig: unit ? readUnitConfig(unit) : undefined,
	};
}

function readUnitConfig(unit: JsonObject): UnitConfig {
	const envs = isObject(unit.envs) ? unit.envs : undefined;
	const local = envs && isObject(envs.local) ? envs.local : undefined;
	const localConfig = local && isObject(local.config) ? local.config : undefined;
	return {
		basePort: typeof unit.basePort === 'number' ? unit.basePort : undefined,
		servingPort: typeof unit.servingPort === 'number' ? unit.servingPort : undefined,
		sslKey: typeof unit.sslKey === 'string' ? unit.sslKey : undefined,
		sslCert: typeof unit.sslCert === 'string' ? unit.sslCert : undefined,
		envs: {
			local: {
				projectId: local && typeof local.projectId === 'string' ? local.projectId : undefined,
				config: {
					configUrl: localConfig && typeof localConfig.configUrl === 'string' ? localConfig.configUrl : undefined,
				},
			},
		},
	};
}

function readJsonFile(path: string): JsonObject {
	if (!existsSync(path))
		throw new Error(`E2E stack: missing ${path}`);
	const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
	return asObject(parsed, path);
}

function unitConfig(packageFile: PackageFile, packageRoot: string): UnitConfig {
	if (!packageFile.unitConfig)
		throw new Error(`E2E stack: missing unitConfig in ${packageRoot}/__package.json`);
	return packageFile.unitConfig;
}

function frontendKeyFromConfigUrl(configUrl: string): string {
	const match = configUrl.match(/_frontend\/([^.]+)\.json/);
	if (!match)
		throw new Error(`E2E stack: cannot read the frontend key from ${configUrl}`);
	return match[1];
}

function requiredString(value: string | undefined, path: string): string {
	if (!value)
		throw new Error(`E2E stack: missing ${path}`);
	return value;
}

function requiredNumber(value: unknown, path: string): number {
	if (typeof value !== 'number')
		throw new Error(`E2E stack: missing ${path}`);
	return value;
}

function optionalNumber(value: unknown): number | undefined {
	if (typeof value !== 'number')
		return undefined;
	return value;
}

function isObject(value: unknown): value is JsonObject {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown, path: string): JsonObject {
	if (!isObject(value))
		throw new Error(`E2E stack: expected an object at ${path}`);
	return value;
}

function stringArray(value: unknown, path: string): string[] {
	if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
		throw new Error(`E2E stack: expected a string array at ${path}`);
	return value as string[];
}
