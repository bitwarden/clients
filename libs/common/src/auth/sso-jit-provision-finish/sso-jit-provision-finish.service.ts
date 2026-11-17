import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  TdeRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { SetKeyConnectorKeyRequest } from "../../key-management/key-connector/models/set-key-connector-key.request";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../models/request/keys.request";
import { UserId } from "../../types/guid";
import { TrustedDeviceKeysRequest } from "../services/devices/requests/trusted-device-keys.request";

/**
 * The result of one `finish*` method. `V1` means the API service sent the client-made keys. `V2`
 * means the SDK made and sent the keys. The caller writes local state from `registration`.
 *
 * TODO: Remove the `V1` member when PM-27327 (master password), PM-27328 (Key Connector), and PM-27329 (trusted device) have removed all V1 paths.
 */
export type SsoJitProvisionFinishResult<TRegistration> =
  { encryptionVersion: "V1" } | { encryptionVersion: "V2"; registration: TRegistration };

/**
 * Keys that the client makes for a V1 encryption master password user. The SDK makes its own keys
 * for V2.
 *
 * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27327 (V1 JIT master password registration).
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
   * Only the V2 path uses this value: the SDK enrolls the user, and skips enrollment when
   * `acceptOrganizationInvite` is `false`.
   *
   * For V1, the caller enrolls the user after the vault unlocks. The caller must skip enrollment
   * when `acceptOrganizationInvite` is `false`: the enrollment endpoint moves an Invited membership
   * to Accepted, so it would accept the open invite too early.
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
   *
   * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27327.
   */
  v1Keys?: SsoJitProvisionFinishPasswordV1Keys;
}

export type SsoJitProvisionFinishPasswordResult =
  SsoJitProvisionFinishResult<JitMasterPasswordRegistrationResponse>;

/**
 * Keys that the client makes for a V1 encryption Key Connector user. The SDK makes its own keys
 * for V2.
 *
 * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27328 (V1 Key Connector registration).
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
   *
   * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27328.
   */
  v1Keys?: SsoJitProvisionFinishKeyConnectorV1Keys;
}

export type SsoJitProvisionFinishKeyConnectorResult =
  SsoJitProvisionFinishResult<KeyConnectorRegistrationResult>;

/**
 * Keys that the client makes for a V1 encryption trusted device user. The SDK makes its own keys
 * for V2.
 *
 * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27329 (V1 TDE registration).
 */
export interface SsoJitProvisionFinishTrustedDeviceV1Keys {
  /** The user's asymmetric key pair */
  keys: KeysRequest;
  /**
   * The user key encapsulated with the organization public key. Required unless
   * `acceptOrganizationInvite` is `false`, because the server enrolls the user in account recovery
   * when it accepts the invite.
   */
  accountRecoveryKey?: string;
  /** The keys that trust the current device. Set only when `trustDevice` is `true`. */
  deviceKeys?: TrustedDeviceKeysRequest;
}

export interface SsoJitProvisionFinishTrustedDeviceData {
  userId: UserId;
  orgId: string;
  /**
   * The identifier of the current device. The V2 path and the legacy V1 device request use it.
   * The `sso-jit-provision-finish/trusted-device` endpoint reads the device from the access token.
   */
  deviceIdentifier: string;
  /** Whether the user chose to trust the current device. */
  trustDevice: boolean;
  /**
   * Whether the server moves the organization membership from Invited to Accepted, and enrolls the
   * user in account recovery. `undefined` means accept.
   */
  acceptOrganizationInvite?: boolean;
  /**
   * The organization public key (B64). Required when the V2 encryption flag is on: the SDK uses
   * it to make the account recovery key.
   */
  orgPublicKey?: string;
  /**
   * Required when the V2 encryption flag is off. Must not be set when the flag is on.
   * See {@link SsoJitProvisionFinishTrustedDeviceV1Keys}.
   *
   * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27329.
   */
  v1Keys?: SsoJitProvisionFinishTrustedDeviceV1Keys;
}

export type SsoJitProvisionFinishTrustedDeviceResult =
  SsoJitProvisionFinishResult<TdeRegistrationResponse>;

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
   *
   * TODO: Remove the flag and the V1 path with https://bitwarden.atlassian.net/browse/PM-27327.
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
   *
   * TODO: Remove the flag and the V1 path with https://bitwarden.atlassian.net/browse/PM-27328.
   */
  abstract finishKeyConnector(
    data: SsoJitProvisionFinishKeyConnectorData,
  ): Promise<SsoJitProvisionFinishKeyConnectorResult>;

  /**
   * Sends the trusted device encryption keys to the server.
   * - `pm-27279-v2-registration-tde-jit` on: the SDK makes the V2 keys and sends them. Requires
   *   `orgPublicKey`. The result contains the SDK registration response, with the device key.
   * - Flag off: sends the V1 keys in `data.v1Keys` through {@link SsoJitProvisionFinishApiService}.
   *   Requires `accountRecoveryKey` unless `acceptOrganizationInvite` is `false`. Requires
   *   `deviceKeys` exactly when `trustDevice` is `true`.
   *
   * This method does not write local state or store the device key. The caller does that after
   * this method returns.
   *
   * TODO: Remove the flag and the V1 path with https://bitwarden.atlassian.net/browse/PM-27329.
   */
  abstract finishTrustedDevice(
    data: SsoJitProvisionFinishTrustedDeviceData,
  ): Promise<SsoJitProvisionFinishTrustedDeviceResult>;
}
