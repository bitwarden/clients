export const DeviceApprovalChannel = Object.freeze({
  Email: 1,
  KeeperPush: 2,
  TwoFactor: 3,
} as const);
export type DeviceApprovalChannel =
  (typeof DeviceApprovalChannel)[keyof typeof DeviceApprovalChannel];
