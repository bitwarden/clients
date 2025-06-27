// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { Component } from "@angular/core";

import { RemovePasswordComponent as BaseRemovePasswordComponent } from "@bitwarden/key-management-ui";

@Component({
  selector: "app-remove-password",
  templateUrl: "remove-password.component.html",
  standalone: false,
})
export class RemovePasswordComponent extends BaseRemovePasswordComponent {}
