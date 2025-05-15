const NotificationQueueMessageType = {
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
  AtRiskPassword: "at-risk-password",
} as const;

type NotificationQueueMessageTypes =
  (typeof NotificationQueueMessageType)[keyof typeof NotificationQueueMessageType];

export { NotificationQueueMessageType, NotificationQueueMessageTypes };
