import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

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
    domain.uri = conditionalEncString(req.uri);
    domain.uriChecksum = conditionalEncString(req.uriChecksum);
    domain.match = req.match;
    return domain;
  }

  uri?: string;
  uriChecksum?: string;
  match?: UriMatchStrategySetting;

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
