import {expect} from 'chai';
import {cloudSchedulerCron, invokerIamDisabled} from '../../main/units/implementations/firebase/cloud-scheduler.js';

describe('Cloud Scheduler for a container function', () => {
	it('keeps a scheduled function private and leaves http functions public', () => {
		expect(invokerIamDisabled('schedule')).to.equal('false');
		expect(invokerIamDisabled('http')).to.equal('true');
		expect(invokerIamDisabled('eventarc')).to.equal('true');
	});

	it('turns the KM daily backup phrase into a cron', () => {
		expect(cloudSchedulerCron('every 24 hours')).to.equal('0 0 * * *');
		expect(cloudSchedulerCron('every 6 hours')).to.equal('0 */6 * * *');
		expect(cloudSchedulerCron('every 15 minutes')).to.equal('*/15 * * * *');
	});

	it('keeps a cron that is already 5 fields', () => {
		expect(cloudSchedulerCron('0 2 * * *')).to.equal('0 2 * * *');
	});

	it('rejects a schedule Cloud Scheduler cannot run', () => {
		expect(() => cloudSchedulerCron('every day')).to.throw(/not a 5-field cron/);
	});
});
