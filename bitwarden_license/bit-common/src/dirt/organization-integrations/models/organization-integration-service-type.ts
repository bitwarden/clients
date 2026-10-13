export const OrganizationIntegrationServiceName = Object.freeze({
  Blumira: "Blumira",
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  GenericHec: "Generic HEC",
  Huntress: "Huntress",
  Splunk: "Splunk",
} as const);

export type OrganizationIntegrationServiceName =
  (typeof OrganizationIntegrationServiceName)[keyof typeof OrganizationIntegrationServiceName];
