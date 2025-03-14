// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { PrePasswordLoginResponse } from "@bitwarden/common/auth/models/response/pre-password-login.response";
import { CipherConfiguration } from "@bitwarden/common/auth/opaque/models/cipher-configuration";
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

import { KdfConfig } from "../../../../../key-management/src";

export type LoginCredentials =
  | PasswordLoginCredentials
  | SsoLoginCredentials
  | UserApiLoginCredentials
  | AuthRequestLoginCredentials
  | WebAuthnLoginCredentials
  | PasswordHashLoginCredentials
  | OpaqueLoginCredentials;

/**
 * Represents email and master password login credentials.
 * This is not used directly by a LogInStrategy, rather it is transformed into a more specific
 * PasswordHashLoginCredentials or OpaqueLoginCredentials depending on which strategy is to be used.
 */
export class PasswordLoginCredentials {
  readonly type = AuthenticationType.Password;

  constructor(
    public email: string,
    public masterPassword: string,
    // TODO: PM-15162 - captcha is deprecated as part of UI refresh work
    public captchaToken?: string,
    public twoFactor?: TokenTwoFactorRequest,
  ) {}

  toSpecificLoginCredentials(
    preLoginResponse: PrePasswordLoginResponse,
  ): PasswordHashLoginCredentials | OpaqueLoginCredentials {
    return preLoginResponse.opaqueConfiguration
      ? new OpaqueLoginCredentials(
          this.email,
          this.masterPassword,
          preLoginResponse.opaqueConfiguration,
        )
      : new PasswordHashLoginCredentials(
          this.email,
          this.masterPassword,
          preLoginResponse.toKdfConfig(),
        );
  }
}

export class SsoLoginCredentials {
  readonly type = AuthenticationType.Sso;

  constructor(
    public code: string,
    public codeVerifier: string,
    public redirectUrl: string,
    public orgId: string,
    /**
     * Optional email address for SSO login.
     * Used for looking up 2FA token on clients that support remembering 2FA token.
     */
    public email?: string,
    public twoFactor?: TokenTwoFactorRequest,
  ) {}
}

export class UserApiLoginCredentials {
  readonly type = AuthenticationType.UserApiKey;

  constructor(
    public clientId: string,
    public clientSecret: string,
  ) {}
}

export class AuthRequestLoginCredentials {
  readonly type = AuthenticationType.AuthRequest;

  constructor(
    public email: string,
    public accessCode: string,
    public authRequestId: string,
    public decryptedUserKey: UserKey,
    public decryptedMasterKey: MasterKey,
    public decryptedMasterKeyHash: string,
    public twoFactor?: TokenTwoFactorRequest,
  ) {}

  static fromJSON(json: Jsonify<AuthRequestLoginCredentials>) {
    return Object.assign(
      new AuthRequestLoginCredentials(
        json.email,
        json.accessCode,
        json.authRequestId,
        null,
        null,
        json.decryptedMasterKeyHash,
        json.twoFactor
          ? new TokenTwoFactorRequest(
              json.twoFactor.provider,
              json.twoFactor.token,
              json.twoFactor.remember,
            )
          : json.twoFactor,
      ),
      {
        decryptedUserKey: SymmetricCryptoKey.fromJSON(json.decryptedUserKey) as UserKey,
        decryptedMasterKey: SymmetricCryptoKey.fromJSON(json.decryptedMasterKey) as MasterKey,
      },
    );
  }
}

export class WebAuthnLoginCredentials {
  readonly type = AuthenticationType.WebAuthn;

  constructor(
    public token: string,
    public deviceResponse: WebAuthnLoginAssertionResponseRequest,
    public prfKey?: SymmetricCryptoKey,
  ) {}

  static fromJSON(json: Jsonify<WebAuthnLoginCredentials>) {
    return new WebAuthnLoginCredentials(
      json.token,
      Object.assign(
        Object.create(WebAuthnLoginAssertionResponseRequest.prototype),
        json.deviceResponse,
      ),
      SymmetricCryptoKey.fromJSON(json.prfKey),
    );
  }
}

export class PasswordHashLoginCredentials {
  readonly type = AuthenticationType.PasswordHash;

  constructor(
    public email: string,
    public masterPassword: string,
    public kdfConfig: KdfConfig,
    // TODO: PM-15162 - captcha is deprecated as part of UI refresh work
    public captchaToken?: string,
    public twoFactor?: TokenTwoFactorRequest,
  ) {}
}

export class OpaqueLoginCredentials {
  readonly type = AuthenticationType.Opaque;

  constructor(
    public email: string,
    public masterPassword: string,
    public cipherConfiguration: CipherConfiguration,
    public twoFactor?: TokenTwoFactorRequest,
  ) {}
}
