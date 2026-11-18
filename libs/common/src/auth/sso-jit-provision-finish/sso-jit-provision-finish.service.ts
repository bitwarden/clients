import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  TdeRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { SsoJitProvisionFinishKeyConnectorParams } from "./sso-jit-provision-finish-key-connector.params";
import { SsoJitProvisionFinishPasswordParams } from "./sso-jit-provision-finish-password.params";
import { SsoJitProvisionFinishTrustedDeviceParams } from "./sso-jit-provision-finish-trusted-device.params";

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
