// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LoginExport } from "@bitwarden/common/models/export/login.export";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

export class LoginResponse extends LoginExport {
  passwordRevisionDate: Date;

  constructor(o: LoginView, viewPassword?: boolean) {
    super(o);
    this.passwordRevisionDate = o.passwordRevisionDate != null ? o.passwordRevisionDate : null;
    if (viewPassword === false) {
      this.password = null;
      this.totp = null;
    }
  }
}
