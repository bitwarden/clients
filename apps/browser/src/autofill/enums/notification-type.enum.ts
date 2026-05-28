const NotificationType = {
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
  AtRiskPassword: "at-risk-password",
  ChangePasswordReminder: "change-password-reminder",
} as const;

type NotificationTypes = (typeof NotificationType)[keyof typeof NotificationType];

export { NotificationType, NotificationTypes };
