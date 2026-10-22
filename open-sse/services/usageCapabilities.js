/**
 * Provider Quota & Health Capabilities Registry
 * Centralized capability matrix for Quota Tracker V2
 */

export const PROVIDER_CAPABILITIES = {
  codex: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 60000,
  },
  kiro: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  claude: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 180000,
  },
  groq: {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: true,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 60000,
  },
  deepseek: {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  openrouter: {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: true,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  github: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  antigravity: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 60000,
  },
  "gemini-cli": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 60000,
  },
  kimi: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  qoder: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  minimax: {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "minimax-cn": {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "codebuddy-cn": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "codebuddy-intl": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "grok-cli": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "vercel-ai-gateway": {
    supportsQuotaApi: false,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: true,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  ollama: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  glm: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "glm-cn": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  zed: {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
  "opencode-go": {
    supportsQuotaApi: true,
    supportsRateLimitHeaders: false,
    supportsBalanceApi: false,
    supportsAuthValidation: true,
    supportsInferenceHealthCheck: true,
    refreshIntervalMs: 120000,
  },
};

const DEFAULT_CAPABILITY = {
  supportsQuotaApi: false,
  supportsRateLimitHeaders: false,
  supportsBalanceApi: false,
  supportsAuthValidation: true,
  supportsInferenceHealthCheck: true,
  refreshIntervalMs: 120000,
};

export function getProviderCapability(providerId) {
  if (!providerId || typeof providerId !== "string") {
    return { ...DEFAULT_CAPABILITY };
  }
  const key = providerId.toLowerCase().trim();
  const configured = PROVIDER_CAPABILITIES[key];
  if (configured) {
    return { provider: key, ...configured };
  }
  return { provider: key, ...DEFAULT_CAPABILITY };
}

export function hasQuotaSupport(providerId) {
  const cap = getProviderCapability(providerId);
  return cap.supportsQuotaApi || cap.supportsRateLimitHeaders || cap.supportsBalanceApi;
}

export function getProviderRefreshInterval(providerId) {
  const cap = getProviderCapability(providerId);
  return cap.refreshIntervalMs || 120000;
}
