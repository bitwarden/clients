import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { Guid } from "../../../types/guid";
import { AuthenticationType } from "../../enums/authentication-type";
import { TokenTwoFactorRequest } from "../request/identity-token/token-two-factor.request";

export class PasswordLogInCredentials {
  readonly type = AuthenticationType.Password;

  constructor(
    public email: string,
    public masterPassword: string,
    public captchaToken?: string,
    public twoFactor?: TokenTwoFactorRequest
  ) {}
}

export class SsoLogInCredentials {
  readonly type = AuthenticationType.Sso;

  constructor(
    public code: string,
    public codeVerifier: string,
    public redirectUrl: string,
    public orgId: Guid,
    public twoFactor?: TokenTwoFactorRequest
  ) {}
}

export class UserApiLogInCredentials {
  readonly type = AuthenticationType.UserApi;

  constructor(public clientId: string, public clientSecret: string) {}
}

export class PasswordlessLogInCredentials {
  readonly type = AuthenticationType.Passwordless;

  constructor(
    public email: string,
    public accessCode: string,
    public authRequestId: Guid,
    public decKey: SymmetricCryptoKey,
    public localPasswordHash: string,
    public twoFactor?: TokenTwoFactorRequest
  ) {}
}
