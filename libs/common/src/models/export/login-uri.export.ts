import { EncString } from "../../key-management/crypto/models/enc-string";
import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { LoginUri as LoginUriDomain } from "../../vault/models/domain/login-uri";
import { LoginUriView } from "../../vault/models/view/login-uri.view";

import { safeGetString } from "./utils";

export class LoginUriExport {
  static template(): LoginUriExport {
    const req = new LoginUriExport();
    req.uri = "https://google.com";
    return req;
  }

  static toView(req: LoginUriExport, view = new LoginUriView()) {
    view.uri = req.uri;
    view.match = req.match;
    return view;
  }

  static toDomain(req: LoginUriExport, domain = new LoginUriDomain()) {
    domain.uri = new EncString(req.uri ?? "");
    domain.uriChecksum = new EncString(req.uriChecksum ?? "");
    domain.match = req.match;
    return domain;
  }

  uri: string = "";
  uriChecksum: string | undefined;
  match?: UriMatchStrategySetting;

  constructor(o?: LoginUriView | LoginUriDomain) {
    if (o == null) {
      return;
    }

    this.uri = safeGetString(o.uri ?? "") ?? "";
    if ("uriChecksum" in o) {
      this.uriChecksum = o.uriChecksum?.encryptedString;
    }
    this.match = o.match;
  }
}
