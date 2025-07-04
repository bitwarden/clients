// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../key-management/crypto/models/enc-string";
import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { LoginUri as LoginUriDomain } from "../../vault/models/domain/login-uri";
import { LoginUriView } from "../../vault/models/view/login-uri.view";

import { safeGetString } from "./utils";

export class LoginUriExport {
  static template(): LoginUriExport {
    const req = new LoginUriExport();
    req.uri = "https://google.com";
    req.match = null;
    return req;
  }

  static toView(req: LoginUriExport, view = new LoginUriView()) {
    view.uri = req.uri;
    view.match = req.match;
    return view;
  }

  static toDomain(req: LoginUriExport, domain = new LoginUriDomain()) {
    domain.uri = req.uri != null ? new EncString(req.uri) : null;
    domain.uriChecksum = req.uriChecksum != null ? new EncString(req.uriChecksum) : null;
    domain.match = req.match;
    return domain;
  }

  uri: string;
  uriChecksum: string | undefined;
  match: UriMatchStrategySetting = null;

  constructor(o?: LoginUriView | LoginUriDomain) {
    if (o == null) {
      return;
    }

    this.uri = safeGetString(o.uri);
    if ("uriChecksum" in o) {
      this.uriChecksum = o.uriChecksum?.encryptedString;
    }
    this.match = o.match;
  }
}
