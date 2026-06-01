import {expect} from 'chai';
import {SyncEnvDeltaSummaryBuilder} from '../../main/modules/sync-env/sync-env-delta.js';

/**
 * Pure unit coverage for the watermark decision + per-dbKey accounting that drives the delta sync.
 * The Firestore batching around it reuses the proven brute-force writer pattern, so the logic worth
 * isolating is exactly this: strictly-newer-than-watermark wins, stale docs are skipped (never written),
 * deletes are tallied, and dbKeys are accounted independently.
 */
describe('SyncEnv - delta summary builder', () => {

	it('upserts a doc strictly newer than the watermark', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		expect(builder.considerUpsert('vars', 101)).to.equal(true);
		expect(builder.summary).to.deep.equal({vars: {upserted: 1, deleted: 0, skipped: 0}});
	});

	it('skips a doc whose __updated equals the watermark (already applied)', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		expect(builder.considerUpsert('vars', 100)).to.equal(false);
		expect(builder.summary).to.deep.equal({vars: {upserted: 0, deleted: 0, skipped: 1}});
	});

	it('skips a doc older than the watermark', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		expect(builder.considerUpsert('vars', 50)).to.equal(false);
		expect(builder.summary).to.deep.equal({vars: {upserted: 0, deleted: 0, skipped: 1}});
	});

	it('upserts everything when the watermark is 0 (full import)', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(0);
		expect(builder.considerUpsert('vars', 1)).to.equal(true);
		expect(builder.considerUpsert('vars', 999)).to.equal(true);
		expect(builder.summary.vars).to.deep.equal({upserted: 2, deleted: 0, skipped: 0});
	});

	it('records deletes per dbKey', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		builder.recordDelete('vars');
		builder.recordDelete('vars');
		builder.recordDelete('tags');
		expect(builder.summary.vars).to.deep.equal({upserted: 0, deleted: 2, skipped: 0});
		expect(builder.summary.tags).to.deep.equal({upserted: 0, deleted: 1, skipped: 0});
	});

	it('accounts upserts, skips and deletes independently across dbKeys', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		builder.considerUpsert('vars', 150); // upsert
		builder.considerUpsert('vars', 80);  // skip
		builder.considerUpsert('tags', 200); // upsert
		builder.recordDelete('tags');
		expect(builder.summary).to.deep.equal({
			vars: {upserted: 1, deleted: 0, skipped: 1},
			tags: {upserted: 1, deleted: 1, skipped: 0},
		});
	});
});
