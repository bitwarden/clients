export const OrganizationSubscriptionTiers = {
  Free: "free",
  Families: "families",
  Teams: "teams",
  TeamsStarter: "teams-starter",
  Enterprise: "enterprise",
} as const;

export type OrganizationSubscriptionTier =
  (typeof OrganizationSubscriptionTiers)[keyof typeof OrganizationSubscriptionTiers];
