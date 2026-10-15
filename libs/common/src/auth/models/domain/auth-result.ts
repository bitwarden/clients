// FIXME: TODO: PM-44095 Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "../../../platform/misc/utils";
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
  // TODO: PM-44095 - Change to `masterPassword?: string` (prefer optional if truly optional). The
  // `masterPassword` parameter of LoginSuccessHandlerService.run and of
  // EncryptedMigrator.runMigrations (and each migration's runMigrations) must change to
  // `masterPassword?: string` with it, and their callers that pass `null` must pass nothing instead.
  // EncryptedMigrator belongs to key management.
  masterPassword: string | null;

  get requiresTwoFactor() {
    return this.twoFactorProviders != null;
  }

  // This is not as extensible as an object-based approach. In the future we may need to adjust to an object based approach.
  get requiresSso() {
    return !Utils.isNullOrWhitespace(this.ssoOrganizationIdentifier);
  }
}
