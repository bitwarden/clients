export const BadgeStatePriority = {
  Low: 0,
  Medium: 100,
  High: 200,
} as const;

export type BadgeStatePriority = (typeof BadgeStatePriority)[keyof typeof BadgeStatePriority];
