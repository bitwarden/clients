import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { AsyncActionsModule, ButtonModule } from "@bitwarden/components";
import { RemovePasswordComponent as BaseRemovePasswordComponent } from "@bitwarden/key-management-ui";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-remove-password",
  templateUrl: "remove-password.component.html",
  imports: [CommonModule, I18nPipe, ButtonModule, AsyncActionsModule],
})
export class RemovePasswordComponent extends BaseRemovePasswordComponent {}
