import { Component } from "@angular/core";

import { RemovePasswordComponent as BaseRemovePasswordComponent } from "@bitwarden/key-management-ui";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-remove-password",
  templateUrl: "remove-password.component.html",
  standalone: false,
})
export class RemovePasswordComponent extends BaseRemovePasswordComponent {}
