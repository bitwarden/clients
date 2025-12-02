// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "../../../types/guid";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

export class AuthResult {
  userId: UserId;
  twoFactorProviders: Partial<Record<TwoFactorProviderType, Record<string, string>>> = null;
  ssoEmail2FaSessionToken?: string;
  email: string;
  requiresEncryptionKeyMigration: boolean;
  requiresDeviceVerification: boolean;

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }
}
