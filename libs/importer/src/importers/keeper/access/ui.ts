export const DeviceApprovalChannel = Object.freeze({
  Email: 1,
  KeeperPush: 2,
  // TODO: Consider adding TwoFactor (3) approval channel in the future
} as const);
export type DeviceApprovalChannel =
  (typeof DeviceApprovalChannel)[keyof typeof DeviceApprovalChannel];

export const TwoFactorMethod = Object.freeze({
  Totp: 1,
  Sms: 2,
  Duo: 3,
  Rsa: 4,
  Backup: 5,
  U2f: 6,
  WebAuthn: 7,
  KeeperPush: 8,
  KeeperDna: 9,
} as const);
export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];

export const DuoMethod = Object.freeze({
  Push: 1,
  Sms: 2,
  Voice: 3,
  Passcode: 4,
} as const);
export type DuoMethod = (typeof DuoMethod)[keyof typeof DuoMethod];

export const Cancel = Symbol("Cancel");
export type Cancel = typeof Cancel;

export const Resend = Symbol("Resend");
export type Resend = typeof Resend;

export interface Ui {
  // Device approval flow
  selectApprovalMethod(method: DeviceApprovalChannel[]): Promise<DeviceApprovalChannel | Cancel>;
  provideApprovalCode(
    method: DeviceApprovalChannel,
    info?: string,
  ): Promise<string | Cancel | Resend>;
  closeApprovalDialog?: () => void;

  // 2FA flow
  selectTwoFactorMethod(channels: TwoFactorMethod[]): Promise<TwoFactorMethod | Cancel>;
  provideTwoFactorCode(method: TwoFactorMethod, info?: string): Promise<string | Cancel | Resend>;

  // DUO specific actions
  selectDuoMethod(methods: DuoMethod[], phoneNumber: string): Promise<DuoMethod | Cancel>;
}
