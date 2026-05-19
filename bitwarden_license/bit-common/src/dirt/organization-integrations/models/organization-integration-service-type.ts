export const OrganizationIntegrationServiceName = Object.freeze({
  Blumira: "Blumira",
  CrowdStrike: "CrowdStrike",
  Datadog: "Datadog",
  Huntress: "Huntress",
  Splunk: "Splunk",
} as const);

export type OrganizationIntegrationServiceName =
  (typeof OrganizationIntegrationServiceName)[keyof typeof OrganizationIntegrationServiceName];
