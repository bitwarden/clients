/** Whether a background feature is currently serving requests. */
export const FeatureStatus = {
  Active: "active",
  Inactive: "inactive",
} as const;
export type FeatureStatus = (typeof FeatureStatus)[keyof typeof FeatureStatus];
