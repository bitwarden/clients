import { Jsonify } from "type-fest";

import { Login as SdkLogin } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
import { LoginData } from "../data/login.data";
import { LoginView } from "../view/login.view";

import { Fido2Credential } from "./fido2-credential";
import { LoginUri } from "./login-uri";

export class Login extends Domain {
  uris?: LoginUri[];
  username?: EncString;
  password?: EncString;
  passwordRevisionDate?: Date;
  totp?: EncString;
  autofillOnPageLoad?: boolean;
  fido2Credentials?: Fido2Credential[];

  constructor(obj?: LoginData) {
    super();
    if (obj == null) {
      return;
    }

    this.passwordRevisionDate =
      obj.passwordRevisionDate != null ? new Date(obj.passwordRevisionDate) : undefined;
    this.autofillOnPageLoad = obj.autofillOnPageLoad;
    this.username = conditionalEncString(obj.username);
    this.password = conditionalEncString(obj.password);
    this.totp = conditionalEncString(obj.totp);

    if (obj.uris) {
      this.uris = obj.uris.map((u) => new LoginUri(u));
    }

    if (obj.fido2Credentials) {
      this.fido2Credentials = obj.fido2Credentials.map((key) => new Fido2Credential(key));
    }
  }

  async decrypt(
    bypassValidation: boolean,
    encKey: SymmetricCryptoKey,
    context: string = "No Cipher Context",
  ): Promise<LoginView> {
    const view = await this.decryptObj<Login, LoginView>(
      this,
      new LoginView(this),
      ["username", "password", "totp"],
      null,
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

        const uri = await this.uris[i].decrypt(encKey, context);
        const uriString = uri.uri;

        if (uriString == null) {
          continue;
        }

        // URIs are shared remotely after decryption
        // we need to validate that the string hasn't been changed by a compromised server
        // This validation is tied to the existence of cypher.key for backwards compatibility
        // So we bypass the validation if there's no cipher.key or proceed with the validation and
        // Skip the value if it's been tampered with.
        const isValidUri =
          bypassValidation || (await this.uris[i].validateChecksum(uriString, encKey));

        if (isValidUri) {
          view.uris.push(uri);
        }
      }
    }

    if (this.fido2Credentials != null) {
      view.fido2Credentials = await Promise.all(
        this.fido2Credentials.map((key) => key.decrypt(encKey)),
      );
    }

    return view;
  }

  toLoginData(): LoginData {
    const l = new LoginData();
    if (this.passwordRevisionDate != null) {
      l.passwordRevisionDate = this.passwordRevisionDate.toISOString();
    }
    if (this.autofillOnPageLoad != null) {
      l.autofillOnPageLoad = this.autofillOnPageLoad;
    }
    this.buildDataModel(this, l, {
      username: null,
      password: null,
      totp: null,
    });

    if (this.uris != null && this.uris.length > 0) {
      l.uris = this.uris.map((u) => u.toLoginUriData());
    }

    if (this.fido2Credentials != null && this.fido2Credentials.length > 0) {
      l.fido2Credentials = this.fido2Credentials.map((key) => key.toFido2CredentialData());
    }

    return l;
  }

  static fromJSON(obj: Partial<Jsonify<Login>> | undefined): Login | undefined {
    if (obj == null) {
      return undefined;
    }

    const login = new Login();
    login.passwordRevisionDate =
      obj.passwordRevisionDate != null ? new Date(obj.passwordRevisionDate) : undefined;
    login.autofillOnPageLoad = obj.autofillOnPageLoad;
    login.username = encStringFrom(obj.username);
    login.password = encStringFrom(obj.password);
    login.totp = encStringFrom(obj.totp);
    login.uris = obj.uris
      ?.map((uri: any) => LoginUri.fromJSON(uri))
      .filter((u): u is LoginUri => u != null);
    login.fido2Credentials =
      obj.fido2Credentials
        ?.map((key) => Fido2Credential.fromJSON(key))
        .filter((c): c is Fido2Credential => c != null) ?? undefined;

    return login;
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
  static fromSdkLogin(obj?: SdkLogin): Login | undefined {
    if (!obj) {
      return undefined;
    }

    const login = new Login();
    login.passwordRevisionDate =
      obj.passwordRevisionDate != null ? new Date(obj.passwordRevisionDate) : undefined;
    login.autofillOnPageLoad = obj.autofillOnPageLoad;
    login.username = encStringFrom(obj.username);
    login.password = encStringFrom(obj.password);
    login.totp = encStringFrom(obj.totp);
    login.uris =
      obj.uris
        ?.filter((u) => u.uri != null)
        .map((uri) => LoginUri.fromSdkLoginUri(uri))
        .filter((u): u is LoginUri => u != null) ?? undefined;
    login.fido2Credentials =
      obj.fido2Credentials
        ?.map((f) => Fido2Credential.fromSdkFido2Credential(f))
        .filter((c): c is Fido2Credential => c != null) ?? undefined;

    return login;
  }
}
