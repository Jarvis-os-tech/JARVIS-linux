// Billing Detection & Provider Top-Up Link Resolver for J.A.R.V.I.S.
// Detects exhausted credits, provides actionable top-up links, and prevents runaway empty requests.
// Ported and enhanced from Hermes (agent/billing_usage.py, agent/billing_links.py)

export interface ProviderBillingInfo {
  provider: string;
  topupUrl: string;
  accountDashboardUrl: string;
  lowBalanceThresholdUsd: number;
}

export const PROVIDER_BILLING_REGISTRY: Record<string, ProviderBillingInfo> = {
  groq: {
    provider: 'Groq Cloud',
    topupUrl: 'https://console.groq.com/settings/billing',
    accountDashboardUrl: 'https://console.groq.com',
    lowBalanceThresholdUsd: 2.0
  },
  nvidia: {
    provider: 'NVIDIA NIM',
    topupUrl: 'https://build.nvidia.com',
    accountDashboardUrl: 'https://build.nvidia.com',
    lowBalanceThresholdUsd: 5.0
  },
  gemini: {
    provider: 'Google AI Studio / Gemini',
    topupUrl: 'https://aistudio.google.com',
    accountDashboardUrl: 'https://console.cloud.google.com/billing',
    lowBalanceThresholdUsd: 5.0
  },
  openai: {
    provider: 'OpenAI Platform',
    topupUrl: 'https://platform.openai.com/account/billing',
    accountDashboardUrl: 'https://platform.openai.com/usage',
    lowBalanceThresholdUsd: 5.0
  },
  anthropic: {
    provider: 'Anthropic Console',
    topupUrl: 'https://console.anthropic.com/settings/billing',
    accountDashboardUrl: 'https://console.anthropic.com/settings/plans',
    lowBalanceThresholdUsd: 5.0
  }
};

export function getBillingNudge(provider: string): string {
  const info = PROVIDER_BILLING_REGISTRY[provider.toLowerCase()];
  if (!info) {
    return `Provider (${provider}) balance exhausted. Please verify API credits in your dashboard.`;
  }
  return `⚠️ ${info.provider} credits exhausted. Top up your balance at: ${info.topupUrl}`;
}
