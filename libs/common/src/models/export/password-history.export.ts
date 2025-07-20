// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../key-management/crypto/models/enc-string";
import { Password } from "../../vault/models/domain/password";
import { PasswordHistoryView } from "../../vault/models/view/password-history.view";

import { safeGetString } from "./utils";

export class PasswordHistoryExport {
  static template(): PasswordHistoryExport {
    const req = new PasswordHistoryExport();
    req.password = null;
    req.lastUsedDate = null;
    return req;
  }

  static toView(req: PasswordHistoryExport, view = new PasswordHistoryView()) {
    view.password = req.password;
    view.lastUsedDate = req.lastUsedDate;
    return view;
  }

  static toDomain(req: PasswordHistoryExport, domain = new Password()) {
    domain.password = req.password != null ? new EncString(req.password) : null;
    domain.lastUsedDate = req.lastUsedDate ? new Date(req.lastUsedDate) : null;
    return domain;
  }

  password: string;
  lastUsedDate: Date = null;

  constructor(o?: PasswordHistoryView | Password) {
    if (o == null) {
      return;
    }

    this.password = safeGetString(o.password);
    this.lastUsedDate = o.lastUsedDate;
  }
}
