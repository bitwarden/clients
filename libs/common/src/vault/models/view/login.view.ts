import { LoginView as SdkLoginView } from "@bitwarden/sdk-internal";

import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { Utils } from "../../../platform/misc/utils";
import { DeepJsonify } from "../../../types/deep-jsonify";
import { LoginLinkedId as LinkedId } from "../../enums";
import { linkedFieldOption } from "../../linked-field-option.decorator";
import { Login } from "../domain/login";

import { Fido2CredentialView } from "./fido2-credential.view";
import { ItemView } from "./item.view";
import { LoginUriView } from "./login-uri.view";

export class LoginView extends ItemView {
  @linkedFieldOption(LinkedId.Username, { sortPosition: 0 })
  username: string | undefined;
  @linkedFieldOption(LinkedId.Password, { sortPosition: 1 })
  password: string | undefined;

  passwordRevisionDate?: Date;
  totp: string | undefined;
  uris: LoginUriView[] = [];
  autofillOnPageLoad: boolean | undefined;
  fido2Credentials: Fido2CredentialView[] = [];

  constructor(l?: Login) {
    super();
    if (!l) {
      return;
    }

    this.passwordRevisionDate = l.passwordRevisionDate;
    this.autofillOnPageLoad = l.autofillOnPageLoad;
  }

  get uri(): string | undefined {
    return this.hasUris ? this.uris[0].uri : undefined;
  }

  get maskedPassword(): string | undefined {
    return this.password != null ? "••••••••" : undefined;
  }

  get subTitle(): string | undefined {
    // if there's a passkey available, use that as a fallback
    if (Utils.isNullOrEmpty(this.username) && this.fido2Credentials?.length > 0) {
      return this.fido2Credentials[0].userName;
    }

    return this.username;
  }

  get canLaunch(): boolean {
    return this.hasUris && this.uris.some((u) => u.canLaunch);
  }

  get hasTotp(): boolean {
    return !Utils.isNullOrWhitespace(this.totp);
  }

  get launchUri(): string | undefined {
    if (this.hasUris) {
      const uri = this.uris.find((u) => u.canLaunch);
      if (uri != null) {
        return uri.launchUri;
      }
    }
    return undefined;
  }

  get hasUris(): boolean {
    return this.uris != null && this.uris.length > 0;
  }

  get hasFido2Credentials(): boolean {
    return this.fido2Credentials != null && this.fido2Credentials.length > 0;
  }

  matchesUri(
    targetUri: string,
    equivalentDomains: Set<string>,
    defaultUriMatch?: UriMatchStrategySetting,
    /** When present, will override the match strategy for the cipher if it is `Never` with `Domain` */
    overrideNeverMatchStrategy?: true,
  ): boolean {
    if (this.uris == null) {
      return false;
    }

    return this.uris.some((uri) =>
      uri.matchesUri(targetUri, equivalentDomains, defaultUriMatch, overrideNeverMatchStrategy),
    );
  }

  static fromJSON(obj: Partial<DeepJsonify<LoginView>> | undefined): LoginView {
    if (obj == undefined) {
      return new LoginView();
    }

    const loginView = Object.assign(new LoginView(), obj) as LoginView;

    loginView.passwordRevisionDate =
      obj.passwordRevisionDate == null ? undefined : new Date(obj.passwordRevisionDate);
    loginView.uris = obj.uris?.map((uri) => LoginUriView.fromJSON(uri)) ?? [];
    loginView.fido2Credentials =
      obj.fido2Credentials?.map((key) => Fido2CredentialView.fromJSON(key)) ?? [];

    return loginView;
  }

  /**
   * Converts the SDK LoginView to a LoginView.
   *
   * Note: FIDO2 credentials remain encrypted at this stage.
   * Unlike other fields that are decrypted as part of the LoginView, the SDK maintains
   * the FIDO2 credentials in encrypted form. We can decrypt them later using a separate
   * call to client.vault().ciphers().decrypt_fido2_credentials().
   */
  static fromSdkLoginView(obj: SdkLoginView): LoginView {
    const loginView = new LoginView();

    loginView.username = obj.username;
    loginView.password = obj.password;
    loginView.passwordRevisionDate =
      obj.passwordRevisionDate == null ? undefined : new Date(obj.passwordRevisionDate);
    loginView.totp = obj.totp;
    loginView.autofillOnPageLoad = obj.autofillOnPageLoad;
    loginView.uris =
      obj.uris
        ?.filter((uri) => uri.uri != null && uri.uri !== "")
        .map((uri) => LoginUriView.fromSdkLoginUriView(uri)!) || [];
    // FIDO2 credentials are not decrypted here, they remain encrypted
    loginView.fido2Credentials = [];

    return loginView;
  }

  /**
   * Converts the LoginView to an SDK LoginView.
   *
   * Note: FIDO2 credentials remain encrypted in the SDK view so they are not included here.
   */
  toSdkLoginView(): SdkLoginView {
    return {
      username: this.username,
      password: this.password,
      passwordRevisionDate: this.passwordRevisionDate?.toISOString(),
      totp: this.totp,
      autofillOnPageLoad: this.autofillOnPageLoad ?? undefined,
      uris: this.uris?.map((uri) => uri.toSdkLoginUriView()),
      fido2Credentials: undefined, // FIDO2 credentials are handled separately and remain encrypted
    };
  }
}
