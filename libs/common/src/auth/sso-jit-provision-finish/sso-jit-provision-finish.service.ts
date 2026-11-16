import { JitMasterPasswordRegistrationResponse } from "@bitwarden/sdk-internal";

import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../models/request/keys.request";
import { UserId } from "../../types/guid";

/**
 * Keys that the client makes for a V1 encryption user. The SDK makes its own keys for V2.
 */
export interface SsoJitProvisionFinishPasswordV1Keys {
  masterPasswordAuthentication: MasterPasswordAuthenticationData;
  masterPasswordUnlock: MasterPasswordUnlockData;
  /** The user's asymmetric key pair */
  keys: KeysRequest;
}

export interface SsoJitProvisionFinishPasswordData {
  userId: UserId;
  orgId: string;
  orgSsoIdentifier: string;
  newPassword: string;
  newPasswordHint: string;
  salt: MasterPasswordSalt;
  /**
   * Only the V2 path uses this value: the SDK enrolls the user. For V1, the caller enrolls the
   * user after the vault unlocks.
   */
  resetPasswordAutoEnroll: boolean;
  /**
   * Whether the server moves the organization membership from Invited to Accepted. `undefined`
   * means accept.
   */
  acceptOrganizationInvite?: boolean;
  /**
   * The organization public key (B64). Required when the V2 encryption flag is on: the SDK uses
   * it to make the account recovery key. The caller gets it, so that this service does not depend
   * on `OrganizationApiService`.
   */
  orgPublicKey?: string;
  /**
   * Required when the V2 encryption flag is off. Must not be set when the flag is on.
   * See {@link SsoJitProvisionFinishPasswordV1Keys}.
   */
  v1Keys?: SsoJitProvisionFinishPasswordV1Keys;
}

export type SsoJitProvisionFinishPasswordResult =
  | { encryptionVersion: "V1" }
  | { encryptionVersion: "V2"; registration: JitMasterPasswordRegistrationResponse };

/**
 * Finishes SSO JIT provisioning for a new organization member. Each method covers one member
 * decryption type.
 *
 * The methods do only the network step. The caller makes the V1 keys, gets the organization data,
 * writes local state, and unlocks.
 */
export abstract class SsoJitProvisionFinishService {
  /**
   * Sends the new master password and keys to the server.
   * - `enable-account-encryption-v2-jit-password-registration` on: the SDK makes the V2 keys and
   *   sends them. The result contains the SDK registration response.
   * - Flag off: sends the V1 keys in `data.v1Keys` through {@link SsoJitProvisionFinishApiService}.
   *
   * Throws before any network call when the data does not match the flag: `v1Keys` set while the
   * flag is on, `v1Keys` missing while the flag is off, or `orgPublicKey` missing while the flag
   * is on.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishPassword(
    data: SsoJitProvisionFinishPasswordData,
  ): Promise<SsoJitProvisionFinishPasswordResult>;
}
