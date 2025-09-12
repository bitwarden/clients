export const OrganizationIntegrationServiceType = Object.freeze({
  CrowdStrike: "CrowdStrike",
} as const);

export type OrganizationIntegrationServiceType =
  (typeof OrganizationIntegrationServiceType)[keyof typeof OrganizationIntegrationServiceType];
