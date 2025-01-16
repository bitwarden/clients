import { SecretVerificationRequest } from "./secret-verification.request";

export class SetVerifyDevicesRequest extends SecretVerificationRequest {
  /**
   * This is the input for a user update that controls [dbo].[Users].[VerifyDevices]
   */
  verifyDevices!: boolean;
}
