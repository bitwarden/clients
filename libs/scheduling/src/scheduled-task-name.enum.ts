export const ScheduledTaskNames = {
  generatePasswordClearClipboardTimeout: "generatePasswordClearClipboardTimeout",
  systemClearClipboardTimeout: "systemClearClipboardTimeout",
  loginStrategySessionTimeout: "loginStrategySessionTimeout",
  notificationsReconnectTimeout: "notificationsReconnectTimeout",
  fido2ClientAbortTimeout: "fido2ClientAbortTimeout",
  scheduleNextSyncInterval: "scheduleNextSyncInterval",
  eventUploadsInterval: "eventUploadsInterval",
  vaultTimeoutCheckInterval: "vaultTimeoutCheckInterval",
  clearPopupViewCache: "clearPopupViewCache",
  targetingRulesUpdate: "targetingRulesUpdate",
  phishingDomainUpdate: "phishingDomainUpdate",
} as const;

export type ScheduledTaskName = (typeof ScheduledTaskNames)[keyof typeof ScheduledTaskNames];
