// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { KeyConnectorUserDecryptionOptionResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/key-connector-user-decryption-option.response";
import { TideCloakUserDecryptionOptionResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/tidecloak-user-decryption-option.response";
import { TrustedDeviceUserDecryptionOptionResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/trusted-device-user-decryption-option.response";

/**
 * Key Connector decryption options. Intended to be sent to the client for use after authentication.
 * @see {@link UserDecryptionOptions}
 */
export class KeyConnectorUserDecryptionOption {
  /** The URL of the key connector configured for this user. */
  keyConnectorUrl: string;

  /**
   * Initializes a new instance of the KeyConnectorUserDecryptionOption from a response object.
   * @param response The key connector user decryption option response object.
   * @returns A new instance of the KeyConnectorUserDecryptionOption or undefined if `response` is nullish.
   */
  static fromResponse(
    response: KeyConnectorUserDecryptionOptionResponse,
  ): KeyConnectorUserDecryptionOption | undefined {
    if (response == null) {
      return undefined;
    }
    const options = new KeyConnectorUserDecryptionOption();
    options.keyConnectorUrl = response?.keyConnectorUrl ?? null;
    return options;
  }

  /**
   * Initializes a new instance of a KeyConnectorUserDecryptionOption from a JSON object.
   * @param obj JSON object to deserialize.
   * @returns A new instance of the KeyConnectorUserDecryptionOption or undefined if `obj` is nullish.
   */
  static fromJSON(
    obj: Jsonify<KeyConnectorUserDecryptionOption>,
  ): KeyConnectorUserDecryptionOption | undefined {
    if (obj == null) {
      return undefined;
    }
    return Object.assign(new KeyConnectorUserDecryptionOption(), obj);
  }
}

/**
 * TideCloak decryption options. Intended to be sent to the client for use after authentication.
 * TideCloak uses Secure Multiparty Computation (SMPC) for key management.
 * @see {@link UserDecryptionOptions}
 */
export class TideCloakUserDecryptionOption {
  /** The URL of the TideCloak service for SDK initialization. */
  tideCloakUrl: string;
  /** The encrypted master key stored on the server (encrypted via SMPC). */
  encryptedMasterKey?: string;

  /**
   * Initializes a new instance of the TideCloakUserDecryptionOption from a response object.
   * @param response The TideCloak user decryption option response object.
   * @returns A new instance of the TideCloakUserDecryptionOption or undefined if `response` is nullish.
   */
  static fromResponse(
    response: TideCloakUserDecryptionOptionResponse,
  ): TideCloakUserDecryptionOption | undefined {
    if (response == null) {
      return undefined;
    }
    const options = new TideCloakUserDecryptionOption();
    options.tideCloakUrl = response?.tideCloakUrl ?? null;
    options.encryptedMasterKey = response?.encryptedMasterKey ?? undefined;
    return options;
  }

  /**
   * Initializes a new instance of a TideCloakUserDecryptionOption from a JSON object.
   * @param obj JSON object to deserialize.
   * @returns A new instance of the TideCloakUserDecryptionOption or undefined if `obj` is nullish.
   */
  static fromJSON(
    obj: Jsonify<TideCloakUserDecryptionOption>,
  ): TideCloakUserDecryptionOption | undefined {
    if (obj == null) {
      return undefined;
    }
    return Object.assign(new TideCloakUserDecryptionOption(), obj);
  }
}

/**
 * Trusted device decryption options. Intended to be sent to the client for use after authentication.
 * @see {@link UserDecryptionOptions}
 */
export class TrustedDeviceUserDecryptionOption {
  /** True if an admin has approved an admin auth request previously made from this device. */
  hasAdminApproval: boolean;
  /** True if the user has a device capable of approving an auth request. */
  hasLoginApprovingDevice: boolean;
  /** True if the user has manage reset password permission, as these users must be forced to have a master password. */
  hasManageResetPasswordPermission: boolean;
  /** True if tde is disabled but user has not set a master password yet. */
  isTdeOffboarding: boolean;

  /**
   * Initializes a new instance of the TrustedDeviceUserDecryptionOption from a response object.
   * @param response The trusted device user decryption option response object.
   * @returns A new instance of the TrustedDeviceUserDecryptionOption or undefined if `response` is nullish.
   */
  static fromResponse(
    response: TrustedDeviceUserDecryptionOptionResponse,
  ): TrustedDeviceUserDecryptionOption | undefined {
    if (response == null) {
      return undefined;
    }
    const options = new TrustedDeviceUserDecryptionOption();
    options.hasAdminApproval = response?.hasAdminApproval ?? false;
    options.hasLoginApprovingDevice = response?.hasLoginApprovingDevice ?? false;
    options.hasManageResetPasswordPermission = response?.hasManageResetPasswordPermission ?? false;
    options.isTdeOffboarding = response?.isTdeOffboarding ?? false;
    return options;
  }

  /**
   * Initializes a new instance of the TrustedDeviceUserDecryptionOption from a JSON object.
   * @param obj JSON object to deserialize.
   * @returns A new instance of the TrustedDeviceUserDecryptionOption or undefined if `obj` is nullish.
   */
  static fromJSON(
    obj: Jsonify<TrustedDeviceUserDecryptionOption>,
  ): TrustedDeviceUserDecryptionOption | undefined {
    if (obj == null) {
      return undefined;
    }
    return Object.assign(new TrustedDeviceUserDecryptionOption(), obj);
  }
}

/**
 * Represents the decryption options the user has configured on the server. This is intended to be sent
 * to the client on authentication, and can be used to determine how to decrypt the user's vault.
 */
export class UserDecryptionOptions {
  /** True if the user has a master password configured on the server. */
  hasMasterPassword: boolean;
  /** {@link TrustedDeviceUserDecryptionOption} */
  trustedDeviceOption?: TrustedDeviceUserDecryptionOption;
  /** {@link KeyConnectorUserDecryptionOption} */
  keyConnectorOption?: KeyConnectorUserDecryptionOption;
  /** {@link TideCloakUserDecryptionOption} */
  tideCloakOption?: TideCloakUserDecryptionOption;

  /**
   * Initializes a new instance of the UserDecryptionOptions from a response object.
   * @param response user decryption options response object
   * @returns A new instance of the UserDecryptionOptions.
   * @throws If the response is nullish, this method will throw an error. User decryption options
   * are required for client initialization.
   */
  static fromIdentityTokenResponse(response: IdentityTokenResponse): UserDecryptionOptions {
    if (response == null) {
      throw new Error(
        "User Decryption Options are required for client initialization. Response is nullish.",
      );
    }

    const decryptionOptions = new UserDecryptionOptions();

    if (response.userDecryptionOptions) {
      // If the response has userDecryptionOptions, this means it's on a post-TDE server version and can interrogate
      // the new decryption options.
      const responseOptions = response.userDecryptionOptions;
      decryptionOptions.hasMasterPassword = responseOptions.hasMasterPassword;

      decryptionOptions.trustedDeviceOption = TrustedDeviceUserDecryptionOption.fromResponse(
        responseOptions.trustedDeviceOption,
      );

      decryptionOptions.keyConnectorOption = KeyConnectorUserDecryptionOption.fromResponse(
        responseOptions.keyConnectorOption,
      );

      decryptionOptions.tideCloakOption = TideCloakUserDecryptionOption.fromResponse(
        responseOptions.tideCloakOption,
      );
    } else {
      throw new Error(
        "User Decryption Options are required for client initialization. userDecryptionOptions is missing in response.",
      );
    }
    return decryptionOptions;
  }

  /**
   * Initializes a new instance of the UserDecryptionOptions from a JSON object.
   * @param obj JSON object to deserialize.
   * @returns A new instance of the UserDecryptionOptions. Will initialize even if the JSON object is nullish.
   */
  static fromJSON(obj: Jsonify<UserDecryptionOptions>): UserDecryptionOptions {
    const decryptionOptions = Object.assign(new UserDecryptionOptions(), obj);

    decryptionOptions.trustedDeviceOption = TrustedDeviceUserDecryptionOption.fromJSON(
      obj?.trustedDeviceOption,
    );

    decryptionOptions.keyConnectorOption = KeyConnectorUserDecryptionOption.fromJSON(
      obj?.keyConnectorOption,
    );

    decryptionOptions.tideCloakOption = TideCloakUserDecryptionOption.fromJSON(
      obj?.tideCloakOption,
    );

    return decryptionOptions;
  }
}
