import {ApiDefResolver, BodyApi, HttpMethod} from '@nu-art/thunderstorm-shared';
import {TSAnalyticsEvent} from './types.js';

export type Analytics_SendEvents = {
	request: {
		events: TSAnalyticsEvent[];
	};
	response: void;
};

export type Analytics_UpdateUser = {
	request: {
		mode: 'set' | 'set_once';
		userData: {
			userId: string;
			firstName?: string;
			lastName?: string;
			displayName?: string
			[key: string]: any;
		}
	};
	response: void;
}

export type Analytics_UpdateLexicon = {
	request: {
		mode: 'set' | 'set_once',
		lexiconMap: {
			[groupKey: string]: { id: string, label: string };
		}
	};
	response: void;
}

export type ApiStruct_Analytics = {
	_v1: {
		sendEvents: BodyApi<Analytics_SendEvents['response'], Analytics_SendEvents['request']>;
		updateUser: BodyApi<Analytics_UpdateUser['response'], Analytics_UpdateUser['request']>;
		updateLexicon: BodyApi<Analytics_UpdateLexicon['response'], Analytics_UpdateLexicon['request']>
	}
}

export const ApiDef_Analytics: (baseUrl?: string) => ApiDefResolver<ApiStruct_Analytics> = (baseUrl) => ({
	_v1: {
		sendEvents: {baseUrl, method: HttpMethod.POST, path: '/v1/analytics/send-events'},
		updateUser: {baseUrl, method: HttpMethod.POST, path: '/v1/analytics/update-user'},
		updateLexicon: {baseUrl, method: HttpMethod.POST, path: '/v1/analytics/update-lexicon'},
	}
});