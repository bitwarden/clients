// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

import { ForceSetPasswordReason } from "./force-set-password-reason";

export class AuthResult {
  userId: UserId;
  captchaSiteKey = "";
  // TODO: PM-3287 - Remove this after 3 releases of backwards compatibility. - Target release 2023.12 for removal
  /**
   * @deprecated
   * Replace with using UserDecryptionOptions to determine if the user does
   * not have a master password and is not using Key Connector.
   * */
  resetMasterPassword = false;

  forcePasswordReset: ForceSetPasswordReason = ForceSetPasswordReason.None;
  twoFactorProviders: Partial<Record<TwoFactorProviderType, Record<string, string>>> = null;
  ssoEmail2FaSessionToken?: string;
  email: string;
  requiresEncryptionKeyMigration: boolean;
  requiresDeviceVerification: boolean;

  get requiresCaptcha() {
    return !Utils.isNullOrWhitespace(this.captchaSiteKey);
  }

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }
}
