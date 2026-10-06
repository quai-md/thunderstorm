import {expect} from 'chai';
import {SyncEnvDeltaSummaryBuilder, SyncEnvLocalNewerTracker} from '../../main/modules/sync-env/sync-env-delta.js';

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

	it('force-upserts a stale local-newer doc', () => {
		const builder = new SyncEnvDeltaSummaryBuilder(100);
		expect(builder.considerUpsert('vars', 50, true)).to.equal(true);
		expect(builder.summary.vars).to.deep.equal({upserted: 1, deleted: 0, skipped: 0});
	});
});

describe('SyncEnv - local-newer tracker', () => {

	it('force-upserts ids seen in the backup and reports unseen as deletes', () => {
		const tracker = new SyncEnvLocalNewerTracker({
			vars: new Set(['keep', 'drop']),
			tags: new Set(['gone']),
		});

		expect(tracker.isLocalNewer('vars', 'keep')).to.equal(true);
		expect(tracker.isLocalNewer('vars', 'other')).to.equal(false);
		tracker.markSeen('vars', 'keep');

		expect(tracker.unseen()).to.have.deep.members([
			{__collectionName: 'vars', __docId: 'drop'},
			{__collectionName: 'tags', __docId: 'gone'},
		]);
	});

	it('force-restores local deletes seen in the backup without leftover-deleting them', () => {
		const force = {vars: new Set(['edited', 'locally-deleted'])};
		const leftover = {vars: new Set(['edited'])};
		const tracker = new SyncEnvLocalNewerTracker(force, leftover);

		expect(tracker.isLocalNewer('vars', 'locally-deleted')).to.equal(true);
		tracker.markSeen('vars', 'locally-deleted');
		tracker.markSeen('vars', 'edited');

		expect(tracker.wasSeen('vars', 'locally-deleted')).to.equal(true);
		expect(tracker.unseen()).to.deep.equal([]);
	});
});
