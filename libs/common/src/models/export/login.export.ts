import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import { Login as LoginDomain } from "../../vault/models/domain/login";
import { LoginView } from "../../vault/models/view/login.view";

import { Fido2CredentialExport } from "./fido2-credential.export";
import { LoginUriExport } from "./login-uri.export";
import { safeGetString } from "./utils";

export class LoginExport {
  static template(): LoginExport {
    const req = new LoginExport();
    req.uris = [];
    req.username = "jdoe";
    req.password = "myp@ssword123";
    req.totp = "JBSWY3DPEHPK3PXP";
    req.fido2Credentials = [];
    return req;
  }

  static toView(req: LoginExport, view = new LoginView()) {
    if (req.uris != null) {
      view.uris = req.uris.map((u) => LoginUriExport.toView(u));
    }
    view.username = req.username;
    view.password = req.password;
    view.totp = req.totp;
    if (req.fido2Credentials != null) {
      view.fido2Credentials = req.fido2Credentials.map((key) => Fido2CredentialExport.toView(key));
    }
    return view;
  }

  static toDomain(req: LoginExport, domain = new LoginDomain()) {
    if (req.uris != null) {
      domain.uris = req.uris.map((u) => LoginUriExport.toDomain(u));
    }
    domain.username = conditionalEncString(req.username);
    domain.password = conditionalEncString(req.password);
    domain.totp = conditionalEncString(req.totp);
    // Fido2credentials are currently not supported for exports.

    return domain;
  }

  uris?: LoginUriExport[];
  username?: string;
  password?: string;
  totp?: string;
  fido2Credentials?: Fido2CredentialExport[];

  constructor(o?: LoginView | LoginDomain) {
    if (o == null) {
      return;
    }

    if (o.uris != null) {
      this.uris = o.uris.map((u) => new LoginUriExport(u));
    }

    if (o.fido2Credentials != null) {
      this.fido2Credentials = o.fido2Credentials.map((key) => new Fido2CredentialExport(key));
    }

    this.username = safeGetString(o.username);
    this.password = safeGetString(o.password);
    this.totp = safeGetString(o.totp);
  }
}
