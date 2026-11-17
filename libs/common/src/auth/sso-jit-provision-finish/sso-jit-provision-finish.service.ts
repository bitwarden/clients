import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
} from "@bitwarden/sdk-internal";

import { SetKeyConnectorKeyRequest } from "../../key-management/key-connector/models/set-key-connector-key.request";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../models/request/keys.request";
import { UserId } from "../../types/guid";

/**
 * The result of one `finish*` method. `V1` means the API service sent the client-made keys. `V2`
 * means the SDK made and sent the keys. The caller writes local state from `registration`.
 */
export type SsoJitProvisionFinishResult<TRegistration> =
  { encryptionVersion: "V1" } | { encryptionVersion: "V2"; registration: TRegistration };

/**
 * Keys that the client makes for a V1 encryption master password user. The SDK makes its own keys
 * for V2.
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
  SsoJitProvisionFinishResult<JitMasterPasswordRegistrationResponse>;

/**
 * Keys that the client makes for a V1 encryption Key Connector user. The SDK makes its own keys
 * for V2.
 */
export interface SsoJitProvisionFinishKeyConnectorV1Keys {
  /**
   * The user key wrapped by the Key Connector key, the KDF settings, the organization SSO
   * identifier, and the account keys. The caller posts the Key Connector key to the Key Connector
   * server before this call.
   */
  keyConnectorKeys: SetKeyConnectorKeyRequest;
}

export interface SsoJitProvisionFinishKeyConnectorData {
  userId: UserId;
  orgSsoIdentifier: string;
  /**
   * Only the V2 path uses this value: the SDK posts the Key Connector key to this server. For V1,
   * the caller posts the key before this call.
   */
  keyConnectorUrl: string;
  /**
   * Whether the server moves the organization membership from Invited to Accepted. `undefined`
   * means accept.
   */
  acceptOrganizationInvite?: boolean;
  /**
   * Required when the V2 encryption flag is off. Must not be set when the flag is on.
   * See {@link SsoJitProvisionFinishKeyConnectorV1Keys}.
   */
  v1Keys?: SsoJitProvisionFinishKeyConnectorV1Keys;
}

export type SsoJitProvisionFinishKeyConnectorResult =
  SsoJitProvisionFinishResult<KeyConnectorRegistrationResult>;

/**
 * Finishes SSO JIT provisioning for a new organization member. Each method covers one member
 * decryption type, and reads its own V2 encryption flag.
 *
 * The methods do only the network step. The caller makes the V1 keys, gets the organization data,
 * writes local state, and unlocks.
 *
 * Each method throws before any network call when the data does not match its flag: `v1Keys` set
 * while the flag is on, or `v1Keys` missing while the flag is off.
 */
export abstract class SsoJitProvisionFinishService {
  /**
   * Sends the new master password and keys to the server.
   * - `enable-account-encryption-v2-jit-password-registration` on: the SDK makes the V2 keys and
   *   sends them. Requires `orgPublicKey`. The result contains the SDK registration response.
   * - Flag off: sends the V1 keys in `data.v1Keys` through {@link SsoJitProvisionFinishApiService}.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishPassword(
    data: SsoJitProvisionFinishPasswordData,
  ): Promise<SsoJitProvisionFinishPasswordResult>;

  /**
   * Sends the Key Connector keys to the server.
   * - `enable-account-encryption-v2-key-connector-registration` on: the SDK makes the V2 keys,
   *   posts the Key Connector key to the Key Connector server, and sends the account keys. The
   *   result contains the SDK registration response.
   * - Flag off: sends the V1 keys in `data.v1Keys` through {@link SsoJitProvisionFinishApiService}.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishKeyConnector(
    data: SsoJitProvisionFinishKeyConnectorData,
  ): Promise<SsoJitProvisionFinishKeyConnectorResult>;
}
