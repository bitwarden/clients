import { DeviceApprovalChannel } from "../enums/device-approval-channel";
import { DuoMethod } from "../enums/duo-method";
import { TwoFactorMethod } from "../enums/two-factor-method";

import { Cancel } from "./cancel";
import { Resend } from "./resend";

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
