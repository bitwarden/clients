export const DeviceApprovalChannel = Object.freeze({
  Email: 1,
  KeeperPush: 2,
  TwoFactor: 3,
  AdminApproval: 4,
  KeeperDna: 5,
} as const);
export type DeviceApprovalChannel =
  (typeof DeviceApprovalChannel)[keyof typeof DeviceApprovalChannel];
