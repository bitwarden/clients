import { Component } from "@angular/core";

import { UpdateTempPasswordComponent as BaseUpdateTempPasswordComponent } from "@bitwarden/angular/auth/components/update-temp-password.component";

@Component({
  selector: "app-update-temp-password",
  templateUrl: "update-temp-password.component.html",
  standalone: false,
})
export class UpdateTempPasswordComponent extends BaseUpdateTempPasswordComponent {}
