/** Shared-secret header for server-to-server analytics callers (EM, short-url). */
export const HeaderKey_AnalyticsSecret = 'x-quai-analytics-secret';

/** GCP Secret Manager secret id (JSON-encoded string payload via SecretKey). */
export const SecretName_AnalyticsS2S = 'analytics-s2s-secret';

/** Query param correlating short-url → EM → Advisor FE for one launch attempt. */
export const QueryParam_LaunchId = 'launchId';
