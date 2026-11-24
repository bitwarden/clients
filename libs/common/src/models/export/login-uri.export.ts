import { EncString } from "@bitwarden/sdk-internal";

import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { LoginUri as LoginUriDomain } from "../../vault/models/domain/login-uri";
import { LoginUriView } from "../../vault/models/view/login-uri.view";

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
    domain.uri = req.uri != null ? (req.uri as EncString) : undefined;
    domain.uriChecksum = req.uriChecksum != null ? (req.uriChecksum as EncString) : undefined;
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

    this.uri = o.uri ?? undefined;
    if ("uriChecksum" in o) {
      this.uriChecksum = o.uriChecksum;
    }
    this.match = o.match;
  }
}
