import {ModuleBE_ExpressFunction_V2} from '@nu-art/firebase-backend';
import {Express, Response} from 'express';
import {currentTimeMillis, generateHex, tsValidateResult, tsValidateShortUrl} from '@nu-art/ts-common';
import {HttpCodes} from '@nu-art/ts-common/core/exceptions/http-codes';
import {HttpsFunction} from 'firebase-functions/v2/https';
import {ModuleBE_ShortUrlDB} from '../_entity/short-url/ModuleBE_ShortUrlDB.js';
import {AxiosHttpModule, Storm} from '@nu-art/thunderstorm-backend';
import {SecretKey} from '@nu-art/google-services-backend/modules/ModuleBE_SecretManager';
import {
	ApiDef_Analytics,
	HeaderKey_AnalyticsSecret,
	QueryParam_LaunchId,
	SecretName_AnalyticsS2S,
	TSAnalyticsEvent,
} from '@nu-art/analytics-shared';

type Config = {
	options?: object;
	/** Advisor BE origin including `/api` prefix, e.g. https://…/api */
	analyticsBaseUrl?: string;
	analyticsSecretName?: string;
	localAnalyticsSecret?: string;
};

class Module_ShortUrlResolver_Class
	extends ModuleBE_ExpressFunction_V2<Config> {

	constructor(name: string = 'url') {
		super(name);
		this.setDefaultConfig({options: {}});
		this.setName(name);
	}

	private handleError = (res: Response, message: string) => {
		res.status(HttpCodes._5XX.INTERNAL_SERVER_ERROR.code).send(message);
	};

	private resolveAnalyticsSecret = async (): Promise<string | undefined> => {
		if (Storm.getInstance().getEnvironment() === 'local')
			return this.config.localAnalyticsSecret;

		const secretName = this.config.analyticsSecretName ?? SecretName_AnalyticsS2S;
		return new SecretKey<string>(secretName).get();
	};

	private emitShortUrlHit = async (params: {
		launchId: string;
		shortUrl: string;
		searchParams: URLSearchParams;
	}) => {
		const baseUrl = this.config.analyticsBaseUrl;
		if (!baseUrl) {
			this.logWarning('Skipping short_url_hit — analyticsBaseUrl not configured');
			return;
		}

		const secret = await this.resolveAnalyticsSecret();
		if (!secret) {
			this.logError('Skipping short_url_hit — analytics S2S secret unavailable');
			return;
		}

		const facilityId =
			params.searchParams.get('facilityId')
			?? params.searchParams.get('facility-id')
			?? undefined;
		const environmentId =
			params.searchParams.get('environmentId')
			?? params.searchParams.get('environment-id')
			?? undefined;

		const properties: Record<string, string> = {
			launchId: params.launchId,
			shortUrl: params.shortUrl,
		};

		const event: TSAnalyticsEvent = {
			key: 'short_url_hit',
			timestamp: currentTimeMillis(),
			properties,
			...(facilityId || environmentId
				? {
					groups: {
						...(facilityId ? {facilityId} : {}),
						...(environmentId ? {environmentId} : {}),
					},
				}
				: {}),
		};

		await AxiosHttpModule
			.createRequest(ApiDef_Analytics(baseUrl)._v1.sendEvents)
			.setBodyAsJson({events: [event]})
			.addHeader(HeaderKey_AnalyticsSecret, secret)
			.executeSync();
	};

	protected createFunction(_express: Express): HttpsFunction {
		_express.get('/*', async (req, res) => {
			const path = req.path.slice(1);

			const validationResult = tsValidateResult(path, tsValidateShortUrl());
			if (validationResult)
				return this.handleError(res, `invalid Url ${validationResult}`);

			const dbShortUrl = (await ModuleBE_ShortUrlDB.query.where({_shortUrl: path}))[0];

			if (!dbShortUrl)
				return this.handleError(res, `short url with path ${path} not found`);

			const url = new URL(dbShortUrl.fullUrl);
			const queryParams = new URLSearchParams(req.query as Record<string, string>);

			queryParams.forEach((value, key) => {
				if (!url.searchParams.has(key))
					url.searchParams.append(key, value);
			});

			const launchId = url.searchParams.get(QueryParam_LaunchId) ?? generateHex(32);
			if (!url.searchParams.has(QueryParam_LaunchId))
				url.searchParams.set(QueryParam_LaunchId, launchId);

			const redirectUrl = url.toString();
			void this.emitShortUrlHit({
				launchId,
				shortUrl: dbShortUrl._shortUrl,
				searchParams: url.searchParams,
			}).catch(err => this.logError('Failed to emit short_url_hit', err));

			return res.status(HttpCodes._3XX.MOVED_PERMANENTLY).redirect(redirectUrl);
		});

		return super.createFunction(_express);
	}
}

export const Module_ShortUrlResolver = new Module_ShortUrlResolver_Class();
