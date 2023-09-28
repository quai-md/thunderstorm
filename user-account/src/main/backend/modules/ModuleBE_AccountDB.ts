import {
	__stringify,
	ApiException,
	BadImplementationException,
	cloneObj,
	compare,
	dispatch_onApplicationException,
	Dispatcher,
	DontCallthisException,
	generateHex,
	hashPasswordWithSalt,
	MUSTNeverHappenException
} from '@nu-art/ts-common';
import {CollectSessionData, ModuleBE_SessionDB} from './ModuleBE_SessionDB';
import {firestore} from 'firebase-admin';
import {QueryParams} from '@nu-art/thunderstorm';
import {addRoutes, createBodyServerApi, createQueryServerApi, DBApiConfigV3, ModuleBE_BaseDBV3} from '@nu-art/thunderstorm/backend';
import {FirestoreQuery} from '@nu-art/firebase';
import {FirestoreInterfaceV3} from '@nu-art/firebase/backend/firestore-v3/FirestoreInterfaceV3';
import {FirestoreType_DocumentSnapshot} from '@nu-art/firebase/backend';
import {Header_SessionId, MemKey_AccountEmail, MemKey_AccountId, SessionKey_Account_BE, SessionKey_Session_BE} from '../core/consts';
import {
	_SessionKey_Account, AccountEmail,
	AccountType,
	ApiDefBE_Account, BaseAccountWithType,
	DB_Account,
	DBDef_Accounts,
	DBProto_AccountType, PasswordWithCheck,
	Request_CreateAccount,
	Request_LoginAccount,
	Request_RegisterAccount,
	RequestBody_ChangePassword,
	RequestBody_CreateToken, RequestBody_Login,
	RequestBody_RegisterAccount,
	RequestBody_SetPassword,
	Response_Auth,
	SafeDB_Account,
	UI_Account
} from '../../shared';
import {assertPasswordRules, PasswordAssertionConfig} from '../../shared/assertion';
import Transaction = firestore.Transaction;


type BaseAccount = {
	email: string,
	type: AccountType,
}
type SpicedAccount = BaseAccount & {
	salt: string,
	saltedPassword: string
};
type AccountToCreate = SpicedAccount | BaseAccount;

export interface OnNewUserRegistered {
	__onNewUserRegistered(account: SafeDB_Account, transaction: Transaction): void;
}

export interface OnUserLogin {
	__onUserLogin(account: SafeDB_Account, transaction: Transaction): void;
}

export const dispatch_onUserLogin = new Dispatcher<OnUserLogin, '__onUserLogin'>('__onUserLogin');

const dispatch_onNewUserRegistered = new Dispatcher<OnNewUserRegistered, '__onNewUserRegistered'>('__onNewUserRegistered');

type Config = DBApiConfigV3<DBProto_AccountType> & {
	canRegister: boolean
	passwordAssertion?: PasswordAssertionConfig
}

export class ModuleBE_AccountDB_Class
	extends ModuleBE_BaseDBV3<DBProto_AccountType, Config>
	implements CollectSessionData<_SessionKey_Account> {

	readonly Middleware = async () => {
		const account = SessionKey_Account_BE.get();
		MemKey_AccountEmail.set(account.email);
		MemKey_AccountId.set(account._id);
	};

	constructor() {
		super(DBDef_Accounts);
	}

	manipulateQuery(query: FirestoreQuery<DB_Account>): FirestoreQuery<DB_Account> {
		return {
			...query,
			select: ['email', '_newPasswordRequired', 'type', '_id', 'thumbnail', 'displayName', '_auditorId']
		};
	}

	canDeleteItems(dbItems: DB_Account[], transaction?: FirebaseFirestore.Transaction): Promise<void> {
		throw new DontCallthisException('Cannot delete accounts yet');
	}

	async __collectSessionData(accountId: string) {
		const account = await this.query.uniqueAssert(accountId);
		return {
			key: 'account' as const,
			value: {
				...makeAccountSafe(account),
				hasPassword: !!account.saltedPassword,
			},
		};
	}

	init() {
		super.init();

		addRoutes([
			createBodyServerApi(ApiDefBE_Account.vv1.registerAccount, this.account.register),
			createBodyServerApi(ApiDefBE_Account.vv1.changePassword, this.account.changePassword),
			createBodyServerApi(ApiDefBE_Account.vv1.login, this.account.login),
			createBodyServerApi(ApiDefBE_Account.vv1.createAccount, this.account.create),
			createQueryServerApi(ApiDefBE_Account.vv1.logout, this.account.logout),
			createBodyServerApi(ApiDefBE_Account.vv1.createToken, this.createToken),
			createBodyServerApi(ApiDefBE_Account.vv1.setPassword, this.account.setPassword)
		]);
	}

	protected async preWriteProcessing(dbInstance: UI_Account, transaction?: Transaction): Promise<void> {
		try {
			dbInstance._auditorId = MemKey_AccountId.get();
		} catch (e) {
			dbInstance._auditorId = dbInstance._id;
		}
	}

	impl = {
		fixEmail: (objectWithEmail: { email: string }) => {
			objectWithEmail.email = objectWithEmail.email.toLowerCase();
		},
		assertPassword: (accountToAssert: RequestBody_SetPassword) => {
			this.password.assertPasswordExistence(accountToAssert.email, accountToAssert.password, accountToAssert.passwordCheck);
			this.password.assertPasswordRules(accountToAssert.password!);
		},
		spiceAccount: (accountToSpice: RequestBody_Login): SpicedAccount => {
			const salt = generateHex(32);
			return {
				email: accountToSpice.email,
				type: 'user',
				salt,
				saltedPassword: hashPasswordWithSalt(salt, accountToSpice.password)
			};
		},
		create: async (accountToCreate: AccountToCreate, transaction: Transaction) => {
			let dbAccount = (await this.query.custom({where: {email: accountToCreate.email}, limit: 1}, transaction))[0];
			if (dbAccount)
				throw new ApiException(422, `User with email "${accountToCreate.email}" already exists`);

			dbAccount = await this.create.item(accountToCreate, transaction);
			return makeAccountSafe(dbAccount);
		},
		setAccountMemKeys: async (account: SafeDB_Account) => {
			MemKey_AccountId.set(account._id);
			MemKey_AccountEmail.set(account.email);
		},
		onAccountCreated: async (account: SafeDB_Account, transaction: Transaction) => {
			await dispatch_onNewUserRegistered.dispatchModuleAsync(account, transaction);
		},
		createSession: async (accountId: string, transaction: Transaction) => {
			return await ModuleBE_SessionDB.getOrCreateSessionV3(accountId, transaction);
		},
		queryUnsafeAccount: async (credentials: AccountEmail, transaction?: Transaction) => {
			const firestoreQuery = FirestoreInterfaceV3.buildQuery<DBProto_AccountType>(this.collection, {where: {email: credentials.email}});
			let results;
			if (transaction)
				results = (await transaction.get(firestoreQuery)).docs as FirestoreType_DocumentSnapshot<DB_Account>[];
			else
				results = (await firestoreQuery.get()).docs as FirestoreType_DocumentSnapshot<DB_Account>[];

			if (results.length !== 1)
				if (results.length === 0) {
					await dispatch_onApplicationException.dispatchModuleAsync(new ApiException(401, `There is no account for email '${credentials.email}'.`), this);
					throw new ApiException(401, 'Wrong username or password.');
				} else if (results.length > 1) {
					throw new MUSTNeverHappenException('Too many users');
				}

			return results[0].data();
		},
		querySafeAccount: async (credentials: AccountEmail, transaction?: Transaction) => {
			const account = await this.impl.queryUnsafeAccount(credentials, transaction);
			return makeAccountSafe(account);
		}
	};

	/**
	 * Create an account without passing through this.spiceAccount - as in without password/salt,
	 * for loginSaml initial login
	 */
	getOrCreateV3 = async (accountToCreate: UI_Account, canCreate = false, transaction?: Transaction) => {
		return await this.runTransaction(async (transaction: Transaction) => {
			const create = async () => {
				if (!canCreate)
					throw new ApiException(422, `User with email "${accountToCreate.email}" already exists`);

				return await this.create.item(accountToCreate, transaction);
			};

			const dbAccount = await this.collection.uniqueGetOrCreate({email: accountToCreate.email}, create, transaction);
			const uiAccount = makeAccountSafe(dbAccount);

			// if these were never set it means we are registering otherwise we are creating other accounts for others
			try {
				MemKey_AccountId.get();
			} catch (e) {
				MemKey_AccountId.set(uiAccount._id);
				MemKey_AccountEmail.set(uiAccount.email);
			}

			await dispatch_onNewUserRegistered.dispatchModuleAsync(uiAccount, transaction);

			return uiAccount;
		});
	};

	account = {
		// this flow is for creating real human users with email and password
		register: async (accountWithPassword: RequestBody_RegisterAccount, transaction?: Transaction): Promise<Response_Auth> => {
			if (!this.config.canRegister)
				throw new ApiException(418, 'Registration is disabled!!');

			this.impl.fixEmail(accountWithPassword);
			this.impl.assertPassword(accountWithPassword);
			const spicedAccount = this.impl.spiceAccount(accountWithPassword);
			return this.runTransaction(async transaction => {
				const dbSafeAccount = await this.impl.create(spicedAccount, transaction);
				await this.impl.setAccountMemKeys(dbSafeAccount);
				await this.impl.onAccountCreated(dbSafeAccount, transaction);
				const encodedSessionData = await this.impl.createSession(dbSafeAccount._id, transaction);
				return {sessionId: encodedSessionData, ...dbSafeAccount};
			});
		},
		login: async (credentials: Request_LoginAccount): Promise<Response_Auth> => {
			this.impl.fixEmail(credentials);

			return this.runTransaction(async transaction => {
				const safeAccount = await this.impl.querySafeAccount(credentials, transaction);
				await this.password.assertPasswordMatch(safeAccount, credentials.password);
				const encodedSessionData = await this.impl.createSession(safeAccount._id, transaction);

				MemKey_AccountId.set(safeAccount._id);

				await dispatch_onUserLogin.dispatchModuleAsync(safeAccount, transaction!);
				return {sessionId: encodedSessionData, ...safeAccount};
			});

		},
		createWithPassword: async (accountWithPassword: Request_RegisterAccount) => {
			this.impl.fixEmail(accountWithPassword);
			this.impl.assertPassword(accountWithPassword);
			const spicedAccount = this.impl.spiceAccount(accountWithPassword);
			return this.runTransaction(async transaction => {
				const dbSafeAccount = await this.impl.create(spicedAccount, transaction);
				await this.impl.onAccountCreated(dbSafeAccount, transaction);
			});
		},
		createWithoutPassword: async (accountWithoutPassword: BaseAccountWithType) => {
			this.impl.fixEmail(accountWithoutPassword);
			return this.runTransaction(async transaction => {
				const dbSafeAccount = await this.impl.create(accountWithoutPassword, transaction);
				await this.impl.onAccountCreated(dbSafeAccount, transaction);
			});
		},
		changePassword: async (passwordToChange: RequestBody_ChangePassword): Promise<Response_Auth> => {
			return this.runTransaction(async transaction => {
				const email = MemKey_AccountEmail.get();

				await this.account.login({email, password: passwordToChange.oldPassword}); // perform login to make sure the old password holds

				if (!compare(passwordToChange.password, passwordToChange.passwordCheck))
					throw new ApiException(401, 'Password check mismatch');

				const safeAccount = await this.impl.querySafeAccount({email});

				this.impl.assertPassword({email, password: passwordToChange.password, passwordCheck: passwordToChange.passwordCheck});
				const spicedAccount = this.impl.spiceAccount({email, password: passwordToChange.password});
				const updatedAccount = await this.set.item({...safeAccount, salt: spicedAccount.salt, saltedPassword: spicedAccount.saltedPassword}, transaction);
				const newSession = await ModuleBE_SessionDB.createSession(updatedAccount._id);
				return {
					...makeAccountSafe(updatedAccount),
					sessionId: newSession._id
				};
			});
		},
		setPassword: async (passwordBody: PasswordWithCheck) => {
			return this.runTransaction(async transaction => {
				const email = MemKey_AccountEmail.get();
				const dbAccount = await this.impl.queryUnsafeAccount({email}, transaction);
				if (dbAccount.saltedPassword)
					throw new ApiException(403, 'account already has password');

				const safeAccount = makeAccountSafe(dbAccount);
				this.impl.assertPassword({email, ...passwordBody});
				const spicedAccount = this.impl.spiceAccount({email, password: passwordBody.password});
				const updatedAccount = await this.set.item({...safeAccount, salt: spicedAccount.salt, saltedPassword: spicedAccount.saltedPassword}, transaction);
				const newSession = await ModuleBE_SessionDB.createSession(updatedAccount._id);
				return {
					...makeAccountSafe(updatedAccount),
					sessionId: newSession._id
				};
			});
		},
		create: async (request: Request_RegisterAccount, transaction?: Transaction) => {
			if (request.type === 'user' && !request.password)
				throw new BadImplementationException('Trying to create a user from type user without password provided');

			request.passwordCheck = request.password;
			return await this.getOrCreateV3(this.composeUIAccountWithPassword(request), true, transaction);
		},
		logout: async (queryParams: QueryParams) => {
			const sessionId = Header_SessionId.get();
			if (!sessionId)
				throw new ApiException(404, 'Missing sessionId');

			await ModuleBE_SessionDB.delete.query({where: {sessionId}});
		}
	};

	password = {
		assertPasswordExistence: (email: string, password?: string, passwordCheck?: string) => {
			if (!password || !passwordCheck)
				throw new ApiException(400, `Did not receive a password for email ${email}.`);

			if (password !== passwordCheck)
				throw new ApiException(400, `Password does not match password check for email ${email}.`);
		},
		assertPasswordRules: (password: string) => {
			const assertPassword = assertPasswordRules(password, this.config.passwordAssertion);
			if (assertPassword)
				throw new ApiException(444, `Password assertion failed with: ${__stringify(assertPassword)}`);
		},
		assertPasswordMatch: async (safeAccount: SafeDB_Account, password: string) => {
			if (!safeAccount.salt || !safeAccount.saltedPassword)
				throw new ApiException(401, 'Account was never logged in using username and password, probably logged using SAML');

			if (hashPasswordWithSalt(safeAccount.salt, password) !== safeAccount.saltedPassword)
				throw new ApiException(401, 'Wrong username or password.');
		}
	};

	private composeUIAccountWithPassword(body: Request_CreateAccount) {
		//Email always lowerCase
		const email = body.email.toLowerCase();

		let account = {email, type: body.type} as UI_Account;

		// TODO: this logic seems faulty.. need to re-done
		if (body.password || body.passwordCheck) {
			this.password.assertPasswordExistence(email, body.password, body.passwordCheck);
			this.password.assertPasswordRules(body.password!);

			account = this.impl.spiceAccount(body as Request_RegisterAccount);
		}
		return account;
	}

	private createToken = async ({accountId, ttl}: RequestBody_CreateToken) => {
		const account = await this.query.unique(accountId);

		if (!account)
			throw new BadImplementationException(`Account not found for id ${accountId}`);

		if (account.type !== 'service')
			throw new BadImplementationException('Can not generate a token for a non service account');

		const {_id} = await ModuleBE_SessionDB.createSession(accountId, (sessionData) => {
			SessionKey_Session_BE.get(sessionData).expiration = ttl;
			return sessionData;
		});

		return {token: _id};
	};
}

export function makeAccountSafe(account: DB_Account): SafeDB_Account {
	const uiAccount = cloneObj(account);
	delete uiAccount.salt;
	delete uiAccount.saltedPassword;
	return uiAccount as DB_Account;
}

export const ModuleBE_AccountDB = new ModuleBE_AccountDB_Class();