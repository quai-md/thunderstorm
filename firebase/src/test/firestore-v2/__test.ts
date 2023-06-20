import {testSuiteTester} from '@nu-art/ts-common/testing/consts';
import {TestSuit_FirestoreV2_Insert} from './insert/insert';
import {TestSuite_FirestoreV2_Delete} from './delete/delete';
import {TestSuit_FirestoreV2_InsertAll} from './insert/insert-all';

describe('Firestore v2 - All Tests', () => {
	testSuiteTester(TestSuit_FirestoreV2_Insert);
	testSuiteTester(TestSuit_FirestoreV2_InsertAll);
	testSuiteTester(TestSuite_FirestoreV2_Delete);
});
