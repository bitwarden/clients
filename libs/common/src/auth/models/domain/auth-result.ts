// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "../../../types/guid";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

export class AuthResult {
  userId: UserId;
  // TODO: PM-3287 - Remove this after 3 releases of backwards compatibility. - Target release 2023.12 for removal
  /**
   * @deprecated
   * Replace with using UserDecryptionOptions to determine if the user does
   * not have a master password and is not using Key Connector.
   * */
  resetMasterPassword = false;

  twoFactorProviders: Partial<Record<TwoFactorProviderType, Record<string, string>>> = null;
  ssoEmail2FaSessionToken?: string;
  email: string;
  requiresEncryptionKeyMigration: boolean;
  requiresDeviceVerification: boolean;

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }
}
