import { Component } from "@angular/core";

import { RemovePasswordComponent as BaseRemovePasswordComponent } from "@bitwarden/key-management-ui";

@Component({
  selector: "app-remove-password",
  templateUrl: "remove-password.component.html",
  standalone: false,
})
export class RemovePasswordComponent extends BaseRemovePasswordComponent {}
