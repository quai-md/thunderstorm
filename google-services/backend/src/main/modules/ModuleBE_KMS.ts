/*
 * Copyright (C) 2020 Yair bcm
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Module, MUSTNeverHappenException, ThisShouldNotHappenException} from '@nu-art/ts-common';
import {KeyManagementServiceClient} from '@google-cloud/kms';

export type ModuleBE_KMS_Config = {
	projectId: string;
	locationId?: string;
};

const DefaultLocationId = 'us-east1';

/** Cloud KMS CryptoKey.CryptoKeyPurpose enum values (for callers). */
export const CryptoKeyPurpose = {
	ASYMMETRIC_SIGN: 1,
	ASYMMETRIC_DECRYPT: 5,
	MAC: 9,
	CRYPTO_KEY_PURPOSE_UNSPECIFIED: 0
} as const;

/** Cloud KMS CryptoKeyVersion.CryptoKeyVersionAlgorithm enum values (for callers). */
export const CryptoKeyVersionAlgorithm = {
	RSA_SIGN_PKCS1_2048_SHA256: 5,
	RSA_SIGN_PKCS1_3072_SHA256: 6,
	RSA_SIGN_PKCS1_4096_SHA256: 7
	// add others as needed
} as const;

export type EnsureCryptoKeyOptions = {
	purpose: number;
	algorithm: number;
};

/** Digest for asymmetric sign: SHA-256 of the data (32 bytes). */
export type KMSDigest = {
	sha256: Buffer;
};

export class ModuleBE_KMS_Class
	extends Module<ModuleBE_KMS_Config> {
	private client!: KeyManagementServiceClient;

	protected init() {
		super.init();
		this.setDefaultConfig({locationId: DefaultLocationId} as Partial<ModuleBE_KMS_Config>);
		this.client = new KeyManagementServiceClient();
	}

	private get parent() {
		const {projectId, locationId} = this.config;
		if (!projectId)
			throw new MUSTNeverHappenException('ModuleBE_KMS requires config.projectId');
		return this.client.locationPath(projectId, locationId ?? DefaultLocationId);
	}

	private keyRingPath(keyRingId: string): string {
		return this.client.keyRingPath(this.config.projectId!, this.config.locationId ?? DefaultLocationId, keyRingId);
	}

	private cryptoKeyPath(keyRingId: string, keyId: string): string {
		return this.client.cryptoKeyPath(
			this.config.projectId!,
			this.config.locationId ?? DefaultLocationId,
			keyRingId,
			keyId
		);
	}

	private cryptoKeyVersionPath(keyRingId: string, keyId: string, versionId: string): string {
		return this.client.cryptoKeyVersionPath(
			this.config.projectId!,
			this.config.locationId ?? DefaultLocationId,
			keyRingId,
			keyId,
			versionId
		);
	}

	/** Create key ring if it does not exist. Idempotent. */
	public ensureKeyRing = async (keyRingId: string): Promise<void> => {
		const parent = this.parent;
		try {
			await this.client.getKeyRing({name: this.keyRingPath(keyRingId)});
			return;
		} catch (err: any) {
			if (err.code !== 5) // NOT_FOUND
				throw new ThisShouldNotHappenException(`Failed to get key ring ${keyRingId}`, err);
		}
		await this.client.createKeyRing({
			parent,
			keyRingId,
			keyRing: {}
		});
	};

	/** Create crypto key with given purpose and algorithm if it does not exist. Idempotent. */
	public ensureCryptoKey = async (keyRingId: string, keyId: string, options: EnsureCryptoKeyOptions): Promise<void> => {
		const parent = this.keyRingPath(keyRingId);
		try {
			await this.client.getCryptoKey({name: this.cryptoKeyPath(keyRingId, keyId)});
			const [versions] = await this.client.listCryptoKeyVersions({
				parent: this.cryptoKeyPath(keyRingId, keyId),
				filter: 'state=ENABLED'
			});
			if (versions.length === 0)
				await this.client.createCryptoKeyVersion({
					parent: this.cryptoKeyPath(keyRingId, keyId),
					cryptoKeyVersion: {}
				});
			return;
		} catch (err: any) {
			if (err.code !== 5)
				throw new ThisShouldNotHappenException(`Failed to get crypto key ${keyRingId}/${keyId}`, err);
		}
		await this.client.createCryptoKey({
			parent,
			cryptoKeyId: keyId,
			cryptoKey: {
				purpose: options.purpose,
				versionTemplate: {algorithm: options.algorithm}
			}
		});
	};

	/** Create a new key version for rotation. Old versions remain until manually destroyed. */
	public createNewKeyVersion = async (keyRingId: string, keyId: string): Promise<string> => {
		const [version] = await this.client.createCryptoKeyVersion({
			parent: this.cryptoKeyPath(keyRingId, keyId),
			cryptoKeyVersion: {}
		});
		const versionId = version.name?.split('/').pop();
		if (!versionId)
			throw new MUSTNeverHappenException(`Missing version id in createCryptoKeyVersion response`);
		return versionId;
	};

	/** List enabled key versions (newest first). */
	public listKeyVersions = async (keyRingId: string, keyId: string): Promise<Array<{ name?: string | null }>> => {
		const [versions] = await this.client.listCryptoKeyVersions({
			parent: this.cryptoKeyPath(keyRingId, keyId),
			filter: 'state=ENABLED'
		});
		// Sort by version number descending (newest first)
		return versions.sort((a, b) => {
			const aVer = parseInt(a.name?.split('/').pop() ?? '0', 10);
			const bVer = parseInt(b.name?.split('/').pop() ?? '0', 10);
			return bVer - aVer;
		});
	};

	/** Get PEM-encoded public key for a key version. */
	public getPublicKey = async (keyRingId: string, keyId: string, versionId: string): Promise<string> => {
		const [pub] = await this.client.getPublicKey({
			name: this.cryptoKeyVersionPath(keyRingId, keyId, versionId)
		});
		if (!pub.pem)
			throw new MUSTNeverHappenException(`Public key has no pem for ${keyRingId}/${keyId}/${versionId}`);
		return pub.pem;
	};

	/** Sign a digest with the given key version. Digest must be SHA-256 (32 bytes). */
	public asymmetricSign = async (keyRingId: string, keyId: string, versionId: string, digest: KMSDigest): Promise<Buffer> => {
		const [response] = await this.client.asymmetricSign({
			name: this.cryptoKeyVersionPath(keyRingId, keyId, versionId),
			digest
		});
		if (!response.signature)
			throw new MUSTNeverHappenException(`asymmetricSign returned no signature`);
		return Buffer.isBuffer(response.signature) ? response.signature : Buffer.from(response.signature as Uint8Array);
	};
}

export const ModuleBE_KMS = new ModuleBE_KMS_Class();
