/** Whether a background feature is currently serving requests. */
export const FeatureActivity = {
  Active: "active",
  Inactive: "inactive",
} as const;
export type FeatureActivity = (typeof FeatureActivity)[keyof typeof FeatureActivity];
