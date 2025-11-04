import { EncString } from "../../key-management/crypto/models/enc-string";
import { Password } from "../../vault/models/domain/password";
import { PasswordHistoryView } from "../../vault/models/view/password-history.view";

import { safeGetString } from "./utils";

export class PasswordHistoryExport {
  static template(): PasswordHistoryExport {
    const req = new PasswordHistoryExport();
    req.password = "";
    req.lastUsedDate = new Date();
    return req;
  }

  static toView(req: PasswordHistoryExport, view = new PasswordHistoryView()) {
    view.password = req.password;
    view.lastUsedDate = req.lastUsedDate ? new Date(req.lastUsedDate) : new Date();
    return view;
  }

  static toDomain(req: PasswordHistoryExport, domain = new Password()) {
    domain.password = new EncString(req.password ?? "");
    domain.lastUsedDate = req.lastUsedDate ?? new Date();
    return domain;
  }

  password: string = "";
  lastUsedDate: Date = new Date();

  constructor(o?: PasswordHistoryView | Password) {
    if (o == null) {
      return;
    }

    this.password = safeGetString(o.password);
    this.lastUsedDate = o.lastUsedDate ?? new Date();
  }
}
