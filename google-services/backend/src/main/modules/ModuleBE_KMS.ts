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

import {ImplementationMissingException, Module, MUSTNeverHappenException, ThisShouldNotHappenException} from '@nu-art/ts-common';
import {KeyManagementServiceClient, protos} from '@google-cloud/kms';

export type ModuleBE_KMS_Config = {
	projectId?: string;
	locationId?: string;
};

/** Optional per-request context for project/location; takes precedence over module config and env. */
export type KMSContext = {
	projectId?: string;
	locationId?: string;
};

/** Default KMS location when not provided via context or config (GCP multi-region "global"). */
const DefaultLocationId = 'global';

/** Re-export KMS purpose enum from package (use for ensureCryptoKey etc.). */
export const CryptoKeyPurpose = protos.google.cloud.kms.v1.CryptoKey.CryptoKeyPurpose;

/** Re-export KMS algorithm enum from package (use for ensureCryptoKey etc.). */
export const CryptoKeyVersionAlgorithm = protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionAlgorithm;

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
		this.client = new KeyManagementServiceClient();
	}

	private resolveContext(requestContext?: KMSContext): { projectId: string; locationId: string } {
		const projectId = requestContext?.projectId
			?? this.config.projectId
			?? process.env.GCP_PROJECT_ID
			?? process.env.GCLOUD_PROJECT;

		if (!projectId)
			throw new ImplementationMissingException(
				'KMS projectId not provided via request context, module config, or env (GCP_PROJECT_ID / GCLOUD_PROJECT)'
			);

		const locationId = requestContext?.locationId
			?? this.config.locationId
			?? DefaultLocationId;

		return { projectId, locationId };
	}

	private getParent(ctx: { projectId: string; locationId: string }): string {
		return this.client.locationPath(ctx.projectId, ctx.locationId);
	}

	private keyRingPath(ctx: { projectId: string; locationId: string }, keyRingId: string): string {
		return this.client.keyRingPath(ctx.projectId, ctx.locationId, keyRingId);
	}

	private cryptoKeyPath(ctx: { projectId: string; locationId: string }, keyRingId: string, keyId: string): string {
		return this.client.cryptoKeyPath(ctx.projectId, ctx.locationId, keyRingId, keyId);
	}

	private cryptoKeyVersionPath(ctx: { projectId: string; locationId: string }, keyRingId: string, keyId: string, versionId: string): string {
		return this.client.cryptoKeyVersionPath(ctx.projectId, ctx.locationId, keyRingId, keyId, versionId);
	}

	/** Create key ring if it does not exist. Idempotent. */
	public ensureKeyRing = async (keyRingId: string, context?: KMSContext): Promise<void> => {
		const ctx = this.resolveContext(context);
		const parent = this.getParent(ctx);
		try {
			await this.client.getKeyRing({name: this.keyRingPath(ctx, keyRingId)});
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
	public ensureCryptoKey = async (keyRingId: string, keyId: string, options: EnsureCryptoKeyOptions, context?: KMSContext): Promise<void> => {
		const ctx = this.resolveContext(context);
		const parent = this.keyRingPath(ctx, keyRingId);
		try {
			await this.client.getCryptoKey({name: this.cryptoKeyPath(ctx, keyRingId, keyId)});
			const [versions] = await this.client.listCryptoKeyVersions({
				parent: this.cryptoKeyPath(ctx, keyRingId, keyId),
				filter: 'state=ENABLED'
			});
			if (versions.length === 0)
				await this.client.createCryptoKeyVersion({
					parent: this.cryptoKeyPath(ctx, keyRingId, keyId),
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
	public createNewKeyVersion = async (keyRingId: string, keyId: string, context?: KMSContext): Promise<string> => {
		const ctx = this.resolveContext(context);
		const [version] = await this.client.createCryptoKeyVersion({
			parent: this.cryptoKeyPath(ctx, keyRingId, keyId),
			cryptoKeyVersion: {}
		});
		const versionId = version.name?.split('/').pop();
		if (!versionId)
			throw new MUSTNeverHappenException(`Missing version id in createCryptoKeyVersion response`);
		return versionId;
	};

	/** List enabled key versions (newest first). */
	public listKeyVersions = async (keyRingId: string, keyId: string, context?: KMSContext): Promise<Array<{ name?: string | null }>> => {
		const ctx = this.resolveContext(context);
		const [versions] = await this.client.listCryptoKeyVersions({
			parent: this.cryptoKeyPath(ctx, keyRingId, keyId),
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
	public getPublicKey = async (keyRingId: string, keyId: string, versionId: string, context?: KMSContext): Promise<string> => {
		const ctx = this.resolveContext(context);
		const [pub] = await this.client.getPublicKey({
			name: this.cryptoKeyVersionPath(ctx, keyRingId, keyId, versionId)
		});
		if (!pub.pem)
			throw new MUSTNeverHappenException(`Public key has no pem for ${keyRingId}/${keyId}/${versionId}`);
		return pub.pem;
	};

	/** Sign a digest with the given key version. Digest must be SHA-256 (32 bytes). */
	public asymmetricSign = async (keyRingId: string, keyId: string, versionId: string, digest: KMSDigest, context?: KMSContext): Promise<Buffer> => {
		const ctx = this.resolveContext(context);
		const [response] = await this.client.asymmetricSign({
			name: this.cryptoKeyVersionPath(ctx, keyRingId, keyId, versionId),
			digest
		});
		if (!response.signature)
			throw new MUSTNeverHappenException(`asymmetricSign returned no signature`);
		return Buffer.isBuffer(response.signature) ? response.signature : Buffer.from(response.signature as Uint8Array);
	};
}

export const ModuleBE_KMS = new ModuleBE_KMS_Class();
