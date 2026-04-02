const NotificationType = {
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
  AtRiskPassword: "at-risk-password",
  ExistingLogin: "existing-login",
} as const;

type NotificationTypes = (typeof NotificationType)[keyof typeof NotificationType];

export { NotificationType, NotificationTypes };
