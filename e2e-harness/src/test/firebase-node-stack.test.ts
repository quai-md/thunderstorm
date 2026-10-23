/*
 * @nu-art/e2e-harness - Node backend + Firebase data emulators
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

import {expect} from 'chai';
import {buildWebServerCommand, patchQuaiEmulatorData, shiftEmulatorPorts, type QuaiNodeStackConfig} from '../main/firebase-node-stack.js';

const config: QuaiNodeStackConfig = {
	label: 'KM',
	projectId: 'quai-md-km-local',
	backendRoot: '/tmp/app-km-backend',
	frontendRoot: '/tmp/app-km-frontend',
	repoRoot: '/tmp',
	nodePort: 8222,
	frontendPort: 8221,
	frontendKey: 'km',
	frontendOrigin: 'https://localhost:8221',
	backendOrigin: 'https://localhost:8222',
	sslKey: '/tmp/localhost.key',
	sslCert: '/tmp/localhost.crt',
	webServerCommand: 'webpack-dev-server',
};

describe('test ports', () => {
	it('starts webpack on the test frontend port and points it at the test database', () => {
		expect(buildWebServerCommand('webpack-dev-server --env app.env=local', 8324, 8321))
			.to.equal('export QUAI_E2E_DATABASE_PORT=8324 && webpack-dev-server --env app.env=local --port 8321');
	});

	it('moves every emulator port by the test offset', () => {
		const emulators = {
			singleProjectMode: true,
			database: {port: 8224},
			firestore: {port: 8225, websocketPort: 8226},
			ui: {port: 8230, enabled: true},
		};
		shiftEmulatorPorts(emulators, 100);
		expect(emulators.database.port).to.equal(8324);
		expect(emulators.firestore).to.deep.equal({port: 8325, websocketPort: 8326});
		expect(emulators.ui).to.deep.equal({port: 8330, enabled: true});
	});
});

describe('patchQuaiEmulatorData', () => {
	it('points the node server, the frontend, and the database emulator at the local ports', () => {
		const data = {
			_config: {
				local: {
					HttpServer: {
						cors: {origins: ['https://localhost:8221']},
					},
				},
			},
			_frontend: {
				km: {
					ModuleFE_XHR: {origin: 'https://localhost:8222'},
					ModuleFE_FirebaseListener: {
						firebaseConfig: {databaseURL: 'https://quai-md-km-local.firebaseio.com'},
						emulatorConfig: {hostname: 'localhost', port: 1},
					},
				},
			},
		};

		const httpServer: {port?: number; ssl?: {key: string; cert: string}; cors: {origins: string[]}} = data._config.local.HttpServer;
		patchQuaiEmulatorData(data, config, 8224);

		expect(httpServer.port).to.equal(8222);
		expect(httpServer.ssl).to.deep.equal({key: config.sslKey, cert: config.sslCert});
		expect(httpServer.cors.origins).to.include('https://127.0.0.1:8222');
		expect(data._frontend.km.ModuleFE_XHR.origin).to.equal('https://localhost:8222');
		expect(data._frontend.km.ModuleFE_FirebaseListener.firebaseConfig.databaseURL).to.equal('http://127.0.0.1:8224?ns=quai-md-km-local');
		expect(data._frontend.km.ModuleFE_FirebaseListener.emulatorConfig).to.deep.equal({hostname: '127.0.0.1', port: 8224});
	});

	it('creates the local config layer when the export does not have one', () => {
		const exportData: {
			_config: {default: object; local?: {HttpServer?: {port?: number}}};
			_frontend: {advisor: object};
		} = {
			_config: {default: {}},
			_frontend: {advisor: {}},
		};
		patchQuaiEmulatorData(exportData, {...config, frontendKey: 'advisor', nodePort: 8402, frontendPort: 8401, frontendOrigin: 'https://localhost:8401', backendOrigin: 'https://localhost:8402'}, 8404);
		expect(exportData._config.local?.HttpServer?.port).to.equal(8402);
	});
});
