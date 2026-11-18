import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  TdeRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { UserId } from "../../types/guid";

export interface SsoJitProvisionFinishPasswordParams {
  userId: UserId;
  orgId: string;
  /** The organization public key (B64). The SDK uses it to make the account recovery key. */
  orgPublicKey: string;
  orgSsoIdentifier: string;
  newPassword: string;
  newPasswordHint: string;
  salt: MasterPasswordSalt;
  /**
   * Whether the SDK enrolls the user in account recovery. The SDK skips enrollment when
   * `acceptOrganizationInvite` is `false`, because enrollment accepts the invite.
   */
  resetPasswordAutoEnroll: boolean;
  /**
   * Whether the server moves the organization membership from Invited to Accepted. `undefined`
   * means accept.
   */
  acceptOrganizationInvite?: boolean;
}

export interface SsoJitProvisionFinishTrustedDeviceParams {
  userId: UserId;
  orgId: string;
  /** The organization public key (B64). The SDK uses it to make the account recovery key. */
  orgPublicKey: string;
  /** The identifier of the current device. */
  deviceIdentifier: string;
  /** Whether the user chose to trust the current device. */
  trustDevice: boolean;
  /**
   * Whether the server moves the organization membership from Invited to Accepted, and enrolls the
   * user in account recovery. `undefined` means accept.
   */
  acceptOrganizationInvite?: boolean;
}

export interface SsoJitProvisionFinishKeyConnectorParams {
  userId: UserId;
  orgSsoIdentifier: string;
  /** The Key Connector server. The SDK posts the Key Connector key to it. */
  keyConnectorUrl: string;
  /**
   * Whether the server moves the organization membership from Invited to Accepted. `undefined`
   * means accept.
   */
  acceptOrganizationInvite?: boolean;
}

/**
 * Finishes SSO JIT provisioning for a new organization member through the SDK (V2 account
 * encryption). Each method covers one member decryption type.
 *
 * The methods do only the network step. The SDK makes the keys and chooses the server endpoint
 * from the `pm-34429-invite-link-auto-confirm` flag. The caller gets the organization data,
 * writes local state from the result, and unlocks.
 */
export abstract class SsoJitProvisionFinishService {
  /**
   * Makes the account keys for a master password user, and sends them with the new master
   * password to the server. When the invite is accepted and `resetPasswordAutoEnroll` is `true`,
   * the SDK also enrolls the user in account recovery.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishPassword(
    params: SsoJitProvisionFinishPasswordParams,
  ): Promise<JitMasterPasswordRegistrationResponse>;

  /**
   * Makes the account keys for a trusted device encryption user, and sends them to the server.
   * When the invite is accepted, the SDK also enrolls the user in account recovery.
   *
   * This method does not write local state or store the device key. The caller does that from
   * the result.
   */
  abstract finishTrustedDevice(
    params: SsoJitProvisionFinishTrustedDeviceParams,
  ): Promise<TdeRegistrationResponse>;

  /**
   * Makes the account keys for a Key Connector user, posts the Key Connector key to the Key
   * Connector server, and sends the account keys to the server.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishKeyConnector(
    params: SsoJitProvisionFinishKeyConnectorParams,
  ): Promise<KeyConnectorRegistrationResult>;
}
