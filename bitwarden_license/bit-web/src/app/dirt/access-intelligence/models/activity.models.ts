export const RenderMode = {
  noCriticalApps: "noCriticalApps",
  criticalAppsWithAtRiskAppsAndNoTasks: "criticalAppsWithAtRiskAppsAndNoTasks",
  criticalAppsWithAtRiskAppsAndTasks: "criticalAppsWithAtRiskAppsAndTasks",
} as const;

export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];
