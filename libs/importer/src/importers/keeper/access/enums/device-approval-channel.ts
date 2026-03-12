export const DeviceApprovalChannel = Object.freeze({
  Email: 1,
  KeeperPush: 2,
  // TODO: Consider adding TwoFactor (3) approval channel in the future
} as const);
export type DeviceApprovalChannel =
  (typeof DeviceApprovalChannel)[keyof typeof DeviceApprovalChannel];
