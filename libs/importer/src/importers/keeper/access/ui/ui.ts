import { DeviceApprovalResult, OtpResult } from "../models";

export abstract class Ui {
  /**
   * Device approval via email verification.
   * User clicks link in email to approve the device.
   * To cancel return DeviceApprovalResult.cancel, otherwise return success.
   */
  approveDeviceByEmail: () => Promise<DeviceApprovalResult>;

  /**
   * Device approval via push notification (out-of-band).
   * User approves on another device.
   * To cancel return DeviceApprovalResult.cancel, otherwise return success.
   */
  approveDeviceByPush: () => Promise<DeviceApprovalResult>;

  /**
   * Two-factor authentication via TOTP code entry.
   * User enters code from authenticator app.
   * To cancel return OtpResult.cancel, otherwise return passcode and rememberMe.
   */
  provideTOTPCode: () => Promise<OtpResult>;

  /**
   * Two-factor authentication via push notification (out-of-band).
   * User approves on another device.
   * To cancel return OtpResult.cancel, otherwise return success.
   */
  approveTwoFactorPush: () => Promise<OtpResult>;

  /** Close any open dialog on import success or error */
  closeDialog: () => void;
}
