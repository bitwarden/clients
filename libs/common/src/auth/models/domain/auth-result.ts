// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { UserId } from "../../../types/guid";
import { TwoFactorProviderType } from "../../enums/two-factor-provider-type";

export class AuthResult {
  userId: UserId;
  twoFactorProviders: Partial<Record<TwoFactorProviderType, Record<string, string>>> = null;
  ssoEmail2FaSessionToken?: string;
  email: string;
  requiresEncryptionKeyMigration: boolean;
  requiresDeviceVerification: boolean;
  ssoOrganizationIdentifier?: string | null;
  // The master-password used in the authentication process
  masterPassword: string | null;

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }

  // This is not as extensible as an object-based approach. In the future we may need to adjust to an object based approach.
  get requiresSso() {
    return !Utils.isNullOrWhitespace(this.ssoOrganizationIdentifier);
  }
}
