const NotificationQueueMessageType = {
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
} as const;

type NotificationQueueMessageTypes =
  (typeof NotificationQueueMessageType)[keyof typeof NotificationQueueMessageType];

export { NotificationQueueMessageType, NotificationQueueMessageTypes };
