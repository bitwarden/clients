import { DeviceApprovalChannel } from "../enums/device-approval-channel";
import { DnaMethod } from "../enums/dna-method";
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
  closeApprovalDialog(): void;

  // 2FA flow
  selectTwoFactorMethod(channels: TwoFactorMethod[]): Promise<TwoFactorMethod | Cancel>;
  provideTwoFactorCode(method: TwoFactorMethod, info?: string): Promise<string | Cancel | Resend>;

  // DUO specific actions
  selectDuoMethod(methods: DuoMethod[], phoneNumber: string): Promise<DuoMethod | Cancel>;
  waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | void>;
  closeDuoPushDialog(): void;

  // Keeper DNA specific actions
  selectDnaMethod(methods: DnaMethod[]): Promise<DnaMethod | Cancel>;
  waitForDnaPush(): Promise<typeof Cancel | void>;
  closeDnaPushDialog(): void;

  // Error display
  showError(message: string): Promise<void>;
}
