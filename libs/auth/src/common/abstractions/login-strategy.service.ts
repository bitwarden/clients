// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { MasterKey } from "@bitwarden/common/types/key";

import {
  UserApiLoginCredentials,
  PasswordLoginCredentials,
  SsoLoginCredentials,
  AuthRequestLoginCredentials,
  WebAuthnLoginCredentials,
} from "../models/domain/login-credentials";

export abstract class LoginStrategyServiceAbstraction {
  /**
   * The current strategy being used to authenticate.
   * Emits null if the session has timed out.
   */
  currentAuthType$: Observable<AuthenticationType | null>;
  /**
   * If the login strategy uses the email address of the user, this
   * will return it. Otherwise, it will return null.
   */
  getEmail: () => Promise<string | null>;
  /**
   * If the user is logging in with a master password, this will return
   * the master password hash. Otherwise, it will return null.
   */
  getMasterPasswordHash: () => Promise<string | null>;
  /**
   * If the user is logging in with SSO, this will return
   * the email auth token. Otherwise, it will return null.
   * @see {@link SsoLoginStrategyData.ssoEmail2FaSessionToken}
   */
  getSsoEmail2FaSessionToken: () => Promise<string | null>;
  /**
   * Returns the access code if the user is logging in with an
   * Auth Request. Otherwise, it will return null.
   */
  getAccessCode: () => Promise<string | null>;
  /**
   * Returns the auth request ID if the user is logging in with an
   * Auth Request. Otherwise, it will return null.
   */
  getAuthRequestId: () => Promise<string | null>;
  /**
   * Sends a token request to the server using the provided credentials.
   */
  logIn: (
    credentials:
      | UserApiLoginCredentials
      | PasswordLoginCredentials
      | SsoLoginCredentials
      | AuthRequestLoginCredentials
      | WebAuthnLoginCredentials,
  ) => Promise<AuthResult>;
  /**
   * Sends a token request to the server with the provided two factor token
   * and captcha response. This uses data stored from {@link LoginStrategyServiceAbstraction.logIn},
   * so that must be called first.
   * Returns an error if no session data is found.
   */
  logInTwoFactor: (
    twoFactor: TokenTwoFactorRequest,
    // TODO: PM-15162 - deprecate captchaResponse
    captchaResponse: string,
  ) => Promise<AuthResult>;
  /**
   * Creates a master key from the provided master password and email.
   */
  makePreloginKey: (masterPassword: string, email: string) => Promise<MasterKey>;
  /**
   * Emits true if the authentication session has expired.
   */
  authenticationSessionTimeout$: Observable<boolean>;
  /**
   * Sends a token request to the server with the provided device verification OTP.
   */
  logInNewDeviceVerification: (deviceVerificationOtp: string) => Promise<AuthResult>;
}
