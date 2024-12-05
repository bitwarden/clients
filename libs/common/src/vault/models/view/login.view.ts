// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  username: string = null;
  @linkedFieldOption(LinkedId.Password, { sortPosition: 1 })
  password: string = null;

  passwordRevisionDate?: Date = null;
  totp: string = null;
  uris: LoginUriView[] = [];
  autofillOnPageLoad: boolean = null;
  fido2Credentials: Fido2CredentialView[] = null;

  constructor(l?: Login) {
    super();
    if (!l) {
      return;
    }

    this.passwordRevisionDate = l.passwordRevisionDate;
    this.autofillOnPageLoad = l.autofillOnPageLoad;
  }

  get uri(): string {
    return this.hasUris ? this.uris[0].uri : null;
  }

  get maskedPassword(): string {
    return this.password != null ? "••••••••" : null;
  }

  get subTitle(): string {
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

  get launchUri(): string {
    if (this.hasUris) {
      const uri = this.uris.find((u) => u.canLaunch);
      if (uri != null) {
        return uri.launchUri;
      }
    }
    return null;
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
    defaultUriMatch: UriMatchStrategySetting = null,
  ): boolean {
    if (this.uris == null) {
      return false;
    }

    return this.uris.some((uri) => uri.matchesUri(targetUri, equivalentDomains, defaultUriMatch));
  }

  static fromJSON(obj: Partial<DeepJsonify<LoginView>>): LoginView {
    const passwordRevisionDate =
      obj.passwordRevisionDate == null ? null : new Date(obj.passwordRevisionDate);
    const uris = obj.uris.map((uri) => LoginUriView.fromJSON(uri));
    const fido2Credentials = obj.fido2Credentials?.map((key) => Fido2CredentialView.fromJSON(key));

    return Object.assign(new LoginView(), obj, {
      passwordRevisionDate,
      uris,
      fido2Credentials,
    });
  }
}
