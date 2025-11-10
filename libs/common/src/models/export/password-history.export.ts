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

  validateRequiredFields() {
    if (!this.password || this.password.trim() === "") {
      throw new Error("Password history password is required.");
    }
  }

  static toView(req: PasswordHistoryExport, view = new PasswordHistoryView()) {
    req.validateRequiredFields();

    view.password = req.password;
    view.lastUsedDate = req.lastUsedDate;
    return view;
  }

  static toDomain(req: PasswordHistoryExport, domain = new Password()) {
    req.validateRequiredFields();

    domain.password = new EncString(req.password);
    domain.lastUsedDate = req.lastUsedDate;
    return domain;
  }

  password: string = "";
  lastUsedDate: Date = new Date();

  constructor(o?: PasswordHistoryView | Password) {
    if (o == null) {
      return;
    }

    this.validateRequiredFields();

    this.password = safeGetString(o.password) ?? "";
    this.lastUsedDate = o.lastUsedDate;
  }
}
