import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DefaultServerSettingsService } from "@bitwarden/common/platform/services/default-server-settings.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LinkModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [CommonModule, JslibModule, LinkModule, RouterModule],
  template: `
    <div class="tw-text-center" *ngIf="!(isUserRegistrationDisabled$ | async)">
      {{ "newToBitwarden" | i18n }}
      <a bitLink routerLink="/signup">{{ "createAccount" | i18n }}</a>
    </div>
  `,
})
export class LoginSecondaryContentComponent {
  serverSettingsService = inject(DefaultServerSettingsService);

  protected isUserRegistrationDisabled$ = this.serverSettingsService.isUserRegistrationDisabled$;
}
