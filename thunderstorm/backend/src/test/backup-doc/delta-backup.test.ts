import {expect} from 'chai';
import {Readable} from 'stream';
import {DeltaBackupRewriter} from '../../main/_entity/backup-doc/backup-delta.js';


const row = (dbKey: string, id: string, document = `{"_id":"${id}"}`) => ({dbKey, _id: id, document});

const collect = async (rewriter: DeltaBackupRewriter, rows: { dbKey: string, _id: string, document: string }[]) => {
	const out: { dbKey: string, _id: string, document: string }[] = [];
	await new Promise<void>((resolve, reject) => {
		Readable.from(rows)
			.pipe(rewriter)
			.on('data', item => out.push(item))
			.on('end', () => resolve())
			.on('error', reject);
	});
	return out;
};

describe('Delta backup rewriter', () => {

	it('copies unchanged rows, overlays edits, drops deletes, appends creates', async () => {
		const newer = {vars: new Map<string, any>([['keep', {_id: 'keep', v: 2}], ['new', {_id: 'new'}]])};
		const deleted = {vars: new Set(['gone'])};
		const rewriter = new DeltaBackupRewriter(new Set(['vars']), newer, deleted, {vars: '1.0.0'}, 3);

		const out = await collect(rewriter, [
			row('vars', 'keep', '{"_id":"keep","v":1}'),
			row('vars', 'gone'),
			row('vars', 'same'),
		]);

		expect(out.map(item => item._id)).to.deep.equal(['keep', 'same', 'new']);
		expect(JSON.parse(out[0].document).v).to.equal(2);
		expect(rewriter.skippedCount).to.equal(1);
		expect(rewriter.appendedCount).to.equal(1);
		expect(rewriter.emittedCount).to.equal(3);
	});

	it('skips rows from collections that are no longer backed up', async () => {
		const rewriter = new DeltaBackupRewriter(new Set(['vars']), {}, {}, {vars: '1.0.0'}, 2);
		const out = await collect(rewriter, [row('vars', 'a'), row('old', 'b')]);
		expect(out.map(item => item._id)).to.deep.equal(['a']);
		expect(rewriter.skippedCount).to.equal(1);
	});
});
