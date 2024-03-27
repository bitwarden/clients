import { Utils } from "../../../platform/misc/utils";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

import { ForceSetPasswordReason } from "./force-set-password-reason";

export class AuthResult {
  captchaSiteKey = "";
  // TODO: PM-3287 - Remove this after 3 releases of backwards compatibility. - Target release 2023.12 for removal
  /**
   * @deprecated
   * Replace with using UserDecryptionOptions to determine if the user does
   * not have a master password and is not using Key Connector.
   * */
  resetMasterPassword = false;

  forcePasswordReset: ForceSetPasswordReason = ForceSetPasswordReason.None;
  twoFactorProviders: Map<TwoFactorProviderType, { [key: string]: string }> = null;
  ssoEmail2FaSessionToken?: string;
  email: string;
  requiresEncryptionKeyMigration: boolean;

  get requiresCaptcha() {
    return !Utils.isNullOrWhitespace(this.captchaSiteKey);
  }

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }
}
