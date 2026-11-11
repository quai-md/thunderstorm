import {strict as assert} from 'node:assert';
import {emitWindowMessage, messageListenerCount} from './mock-window.js';
import {ModuleFE_WindowMessenger, Receiver} from '../../main/modules/ModuleFE_WindowMessenger.js';

type LaunchMessage = {
	key: 'launch';
	data: unknown;
};

const mounted: Receiver<LaunchMessage>[] = [];

function mountCollector(filter?: (message: unknown) => boolean) {
	const received: unknown[] = [];
	const receiver = new Receiver<LaunchMessage>('.*', (data: unknown) => [{key: 'launch', data}]);
	if (filter)
		receiver.setFilter(filter);

	receiver.addProcessor('launch', message => received.push(message.data));
	receiver.mount();
	mounted.push(receiver);
	return received;
}

describe('ModuleFE_WindowMessenger early listener', () => {

	afterEach(() => {
		mounted.forEach(receiver => receiver.unmount());
		mounted.length = 0;
		const sink = new Receiver<LaunchMessage>('.*', (data: unknown) => [{key: 'launch', data}]);
		sink.mount();
		sink.unmount();
	});

	it('listens before any receiver is mounted', () => {
		assert.equal(messageListenerCount(), 1);
		assert.equal(ModuleFE_WindowMessenger.receivers.length, 0);
	});

	it('replays messages that arrived before mount, in order', () => {
		emitWindowMessage('https://parent.example', {encounterFhirId: 'first'});
		emitWindowMessage('https://parent.example', {encounterFhirId: 'second'});

		const received = mountCollector();

		assert.deepEqual(received, [
			{encounterFhirId: 'first'},
			{encounterFhirId: 'second'},
		]);
	});

	it('delivers a message once after the receiver is mounted', () => {
		const received = mountCollector();

		emitWindowMessage('https://parent.example', {encounterFhirId: 'live'});

		assert.deepEqual(received, [{encounterFhirId: 'live'}]);
	});

	it('does not replay an already delivered message to a later receiver', () => {
		emitWindowMessage('https://parent.example', {encounterFhirId: 'before'});
		const first = mountCollector();
		const second = mountCollector();

		emitWindowMessage('https://parent.example', {encounterFhirId: 'after'});

		assert.deepEqual(first, [
			{encounterFhirId: 'before'},
			{encounterFhirId: 'after'},
		]);
		assert.deepEqual(second, [{encounterFhirId: 'after'}]);
	});

	it('buffers again after the last receiver unmounts', () => {
		mountCollector();
		mounted.forEach(receiver => receiver.unmount());
		mounted.length = 0;

		emitWindowMessage('https://parent.example', {encounterFhirId: 'while-unmounted'});
		const second = mountCollector();

		assert.deepEqual(second, [{encounterFhirId: 'while-unmounted'}]);
		assert.equal(messageListenerCount(), 1);
	});

	it('logs keys of a buffered message and not its values', () => {
		const lines: string[] = [];
		const original = console.log;
		console.log = (line?: unknown) => {
			lines.push(String(line));
		};
		try {
			emitWindowMessage('https://parent.example', {encounterFhirId: 'secret-value', launchTimestamp: '1'});
			mountCollector();

			assert.equal(lines.length, 1);
			assert.equal(lines[0].includes('buffered=true'), true);
			assert.equal(lines[0].includes('keys=encounterFhirId,launchTimestamp'), true);
			assert.equal(lines[0].includes('secret-value'), false);
		} finally {
			console.log = original;
		}
	});

	it('drops a buffered message the receiver filters out', () => {
		emitWindowMessage('https://parent.example', {kind: 'noise'});
		emitWindowMessage('https://parent.example', {encounterFhirId: 'kept'});

		const received = mountCollector(message => {
			const data = message as {encounterFhirId?: string};
			return !!data.encounterFhirId;
		});

		assert.deepEqual(received, [{encounterFhirId: 'kept'}]);
	});
});
