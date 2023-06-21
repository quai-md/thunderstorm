import {testSuiteTester} from '@nu-art/ts-common/testing/consts';
import {TestSuite_FirestoreV2_Insert} from './insert';
import {TestSuite_FirestoreV2_CreateAll} from './insert-all';

describe('Firestore v2 - Insert and InsertAll', () => {
	testSuiteTester(TestSuite_FirestoreV2_Insert);
	testSuiteTester(TestSuite_FirestoreV2_CreateAll);
});