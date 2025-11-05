export const OrganizationIntegrationType = Object.freeze({
  CloudBillingSync: 1,
  Scim: 2,
  Slack: 3,
  Webhook: 4,
  Hec: 5,
  Datadog: 6,
} as const);

export type OrganizationIntegrationType =
  (typeof OrganizationIntegrationType)[keyof typeof OrganizationIntegrationType];
