import { LoginApi } from "../api/login.api";

import { Fido2CredentialData } from "./fido2-credential.data";
import { LoginUriData } from "./login-uri.data";

export class LoginData {
  uris?: LoginUriData[];
  username?: string;
  password?: string;
  passwordRevisionDate?: string;
  totp?: string;
  autofillOnPageLoad?: boolean;
  fido2Credentials?: Fido2CredentialData[];

  constructor(data?: LoginApi) {
    if (data == null) {
      return;
    }

    this.username = data.username;
    this.password = data.password;
    this.passwordRevisionDate = data.passwordRevisionDate;
    this.totp = data.totp;
    this.autofillOnPageLoad = data.autofillOnPageLoad;

    if (data.uris) {
      this.uris = data.uris.map((u) => new LoginUriData(u));
    }

    if (data.fido2Credentials) {
      this.fido2Credentials = data.fido2Credentials?.map((key) => new Fido2CredentialData(key));
    }
  }
}
