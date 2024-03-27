import { Component } from "@angular/core";

import { SetPasswordComponent as BaseSetPasswordComponent } from "@bitwarden/angular/auth/components/set-password.component";

@Component({
  selector: "app-set-password",
  templateUrl: "set-password.component.html",
})
export class SetPasswordComponent extends BaseSetPasswordComponent {}
