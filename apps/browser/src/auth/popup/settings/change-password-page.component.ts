import { Component } from "@angular/core";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { InputPasswordFlow } from "@bitwarden/auth/angular";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "change-password-page",
  templateUrl: "change-password-page.component.html",
  imports: [
    ChangePasswordComponent,
    I18nPipe,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
  ],
})
export class ChangePasswordPageComponent {
  // We cannot use ChangePasswordWithOptionalUserKeyRotation as the UserKeyRotation service + several service deps it has
  // are only available in the web currently. We would need to migrate those services to common to be able to use the flow here.
  protected readonly inputPasswordFlow = InputPasswordFlow.ChangePassword;

  constructor() {}
}
