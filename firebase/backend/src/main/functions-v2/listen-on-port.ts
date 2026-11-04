import {Express} from 'express';

export function listenOnPort(app: Express, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const server = app.listen(port, () => resolve());
		server.on('error', reject);
	});
}
