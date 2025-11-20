export const OrganizationIntegrationServiceType = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
} as const);

export type OrganizationIntegrationServiceType =
  (typeof OrganizationIntegrationServiceType)[keyof typeof OrganizationIntegrationServiceType];
