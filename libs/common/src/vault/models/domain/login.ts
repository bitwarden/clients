// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Login as SdkLogin } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { LoginData } from "../data/login.data";
import { LoginView } from "../view/login.view";

import { Fido2Credential } from "./fido2-credential";
import { LoginUri } from "./login-uri";

export class Login extends Domain {
  uris: LoginUri[];
  username: EncString;
  password: EncString;
  passwordRevisionDate?: Date;
  totp: EncString;
  autofillOnPageLoad: boolean;
  fido2Credentials: Fido2Credential[];

  constructor(obj?: LoginData) {
    super();
    if (obj == null) {
      return;
    }

    this.passwordRevisionDate =
      obj.passwordRevisionDate != null ? new Date(obj.passwordRevisionDate) : null;
    this.autofillOnPageLoad = obj.autofillOnPageLoad;
    this.buildDomainModel(
      this,
      obj,
      {
        username: null,
        password: null,
        totp: null,
      },
      [],
    );

    if (obj.uris) {
      this.uris = [];
      obj.uris.forEach((u) => {
        this.uris.push(new LoginUri(u));
      });
    }

    if (obj.fido2Credentials) {
      this.fido2Credentials = obj.fido2Credentials.map((key) => new Fido2Credential(key));
    }
  }

  async decrypt(
    orgId: string,
    bypassValidation: boolean,
    context: string = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<LoginView> {
    const view = await this.decryptObj<Login, LoginView>(
      this,
      new LoginView(this),
      ["username", "password", "totp"],
      orgId,
      encKey,
      `DomainType: Login; ${context}`,
    );

    if (this.uris != null) {
      view.uris = [];
      for (let i = 0; i < this.uris.length; i++) {
        // If the uri is null, there is nothing to decrypt or validate
        if (this.uris[i].uri == null) {
          continue;
        }

        const uri = await this.uris[i].decrypt(orgId, context, encKey);
        // URIs are shared remotely after decryption
        // we need to validate that the string hasn't been changed by a compromised server
        // This validation is tied to the existence of cypher.key for backwards compatibility
        // So we bypass the validation if there's no cipher.key or procceed with the validation and
        // Skip the value if it's been tampered with.
        if (bypassValidation || (await this.uris[i].validateChecksum(uri.uri, orgId, encKey))) {
          view.uris.push(uri);
        }
      }
    }

    if (this.fido2Credentials != null) {
      view.fido2Credentials = await Promise.all(
        this.fido2Credentials.map((key) => key.decrypt(orgId, encKey)),
      );
    }

    return view;
  }

  toLoginData(): LoginData {
    const l = new LoginData();
    l.passwordRevisionDate =
      this.passwordRevisionDate != null ? this.passwordRevisionDate.toISOString() : null;
    l.autofillOnPageLoad = this.autofillOnPageLoad;
    this.buildDataModel(this, l, {
      username: null,
      password: null,
      totp: null,
    });

    if (this.uris != null && this.uris.length > 0) {
      l.uris = [];
      this.uris.forEach((u) => {
        l.uris.push(u.toLoginUriData());
      });
    }

    if (this.fido2Credentials != null && this.fido2Credentials.length > 0) {
      l.fido2Credentials = this.fido2Credentials.map((key) => key.toFido2CredentialData());
    }

    return l;
  }

  static fromJSON(obj: Partial<Jsonify<Login>>): Login {
    if (obj == null) {
      return null;
    }

    const username = EncString.fromJSON(obj.username);
    const password = EncString.fromJSON(obj.password);
    const totp = EncString.fromJSON(obj.totp);
    const passwordRevisionDate =
      obj.passwordRevisionDate == null ? null : new Date(obj.passwordRevisionDate);
    const uris = obj.uris?.map((uri: any) => LoginUri.fromJSON(uri));
    const fido2Credentials =
      obj.fido2Credentials?.map((key) => Fido2Credential.fromJSON(key)) ?? [];

    return Object.assign(new Login(), obj, {
      username,
      password,
      totp,
      passwordRevisionDate,
      uris,
      fido2Credentials,
    });
  }

  /**
   * Maps Login to SDK format.
   *
   * @returns {SdkLogin} The SDK login object.
   */
  toSdkLogin(): SdkLogin {
    return {
      uris: this.uris?.map((u) => u.toSdkLoginUri()),
      username: this.username?.toSdk(),
      password: this.password?.toSdk(),
      passwordRevisionDate: this.passwordRevisionDate?.toISOString(),
      totp: this.totp?.toSdk(),
      autofillOnPageLoad: this.autofillOnPageLoad ?? undefined,
      fido2Credentials: this.fido2Credentials?.map((f) => f.toSdkFido2Credential()),
    };
  }

  /**
   * Maps an SDK Login object to a Login
   * @param obj - The SDK Login object
   */
  static fromSdkLogin(obj: SdkLogin): Login | undefined {
    if (!obj) {
      return undefined;
    }

    const login = new Login();

    login.uris =
      obj.uris?.filter((u) => u.uri != null).map((uri) => LoginUri.fromSdkLoginUri(uri)) ?? [];
    login.username = EncString.fromJSON(obj.username);
    login.password = EncString.fromJSON(obj.password);
    login.passwordRevisionDate = obj.passwordRevisionDate
      ? new Date(obj.passwordRevisionDate)
      : undefined;
    login.totp = EncString.fromJSON(obj.totp);
    login.autofillOnPageLoad = obj.autofillOnPageLoad ?? false;
    login.fido2Credentials = obj.fido2Credentials?.map((f) =>
      Fido2Credential.fromSdkFido2Credential(f),
    );

    return login;
  }
}
