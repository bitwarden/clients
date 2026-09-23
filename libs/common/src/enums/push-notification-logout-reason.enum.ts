export const PushNotificationLogOutReasonType = Object.freeze({
  KdfChange: 0,
  KeyRotation: 1,
} as const);

export type PushNotificationLogOutReasonType =
  (typeof PushNotificationLogOutReasonType)[keyof typeof PushNotificationLogOutReasonType];
