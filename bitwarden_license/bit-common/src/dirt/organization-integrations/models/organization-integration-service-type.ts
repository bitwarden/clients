export const OrganizationIntegrationServiceName = Object.freeze({
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress",
} as const);

export type OrganizationIntegrationServiceName =
  (typeof OrganizationIntegrationServiceName)[keyof typeof OrganizationIntegrationServiceName];
