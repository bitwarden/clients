// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { IdpProvider, LastpassLoginType } from "../enums";

export class UserTypeContext {
  type: LastpassLoginType;
  identityProviderGUID: string;
  identityProviderURL: string;
  openIDConnectAuthority: string;
  openIDConnectClientId: string;
  companyId: number;
  provider: IdpProvider;
  pkceEnabled: boolean;
  isPasswordlessEnabled: boolean;

  isFederated(): boolean {
    return (
      this.type === LastpassLoginType.Federated &&
      this.hasValue(this.identityProviderURL) &&
      this.hasValue(this.openIDConnectAuthority) &&
      this.hasValue(this.openIDConnectClientId)
    );
  }

  get oidcScope(): string {
    let scope = "openid profile email";
    if (this.provider === IdpProvider.PingOne) {
      scope += " lastpass";
    }
    return scope;
  }

  get openIDConnectAuthorityBase(): string {
    return this.openIDConnectAuthority.replace("/.well-known/openid-configuration", "");
  }

  private hasValue(str: string) {
    return str != null && str.trim() !== "";
  }
}
