import { DeviceApprovalChannel } from "../enums/device-approval-channel";
import { DnaMethod } from "../enums/dna-method";
import { DuoMethod } from "../enums/duo-method";
import { TwoFactorMethod } from "../enums/two-factor-method";

import { Cancel } from "./cancel";
import { Resend } from "./resend";
import { TryAnother } from "./try-another";

export interface ProvideTwoFactorCodeOptions {
  /** True for the device-approval-via-2FA flow where Keeper hides the configured method. */
  hidden?: boolean;
  /** True if the underlying method (e.g. SMS) supports re-sending a code. */
  canResend?: boolean;
}

export interface Ui {
  // Device approval flow
  selectApprovalMethod(method: DeviceApprovalChannel[]): Promise<DeviceApprovalChannel | Cancel>;
  provideApprovalCode(
    method: DeviceApprovalChannel,
    info?: string,
  ): Promise<string | Cancel | Resend | TryAnother>;
  closeApprovalDialog(): void;

  // 2FA flow
  selectTwoFactorMethod(channels: TwoFactorMethod[]): Promise<TwoFactorMethod | Cancel>;
  provideTwoFactorCode(
    method: TwoFactorMethod,
    options?: ProvideTwoFactorCodeOptions,
  ): Promise<string | Cancel | Resend | TryAnother>;

  // DUO specific actions
  selectDuoMethod(methods: DuoMethod[], phoneNumber: string): Promise<DuoMethod | Cancel>;
  waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | typeof TryAnother | void>;
  closeDuoPushDialog(): void;

  // Keeper DNA specific actions
  selectDnaMethod(methods: DnaMethod[]): Promise<DnaMethod | Cancel>;
  waitForDnaPush(): Promise<typeof Cancel | typeof TryAnother | void>;
  closeDnaPushDialog(): void;

  // Password prompt (deferred until server requests it)
  promptForPassword(): Promise<string | Cancel>;

  // Error display
  showError(message: string): Promise<void>;
}
