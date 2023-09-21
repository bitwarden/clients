import { EncString } from "../../platform/models/domain/enc-string";
import { Password } from "../../vault/models/domain/password";
import { PasswordHistoryView } from "../../vault/models/view/password-history.view";

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
    domain.lastUsedDate = req.lastUsedDate;
    return domain;
  }

  password: string;
  lastUsedDate: Date = null;

  constructor(o?: PasswordHistoryView | Password) {
    if (o == null) {
      return;
    }

    if (o instanceof PasswordHistoryView) {
      this.password = o.password;
    } else {
      this.password = o.password?.encryptedString;
    }
    this.lastUsedDate = o.lastUsedDate;
  }
}
