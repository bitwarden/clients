import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RegisterRouteService } from "@bitwarden/auth/common";
import { ServerSettingsService } from "@bitwarden/common/platform/services/server-settings.service";

@Component({
  standalone: true,
  imports: [CommonModule, JslibModule, RouterModule],
  template: `
    <div class="tw-text-center" *ngIf="!isUserRegistrationDisabled">
      {{ "newToBitwarden" | i18n }}
      <a
        class="tw-font-bold tw-no-underline hover:tw-underline tw-text-primary-600"
        bitLink
        [routerLink]="registerRoute$ | async"
        >{{ "createAccount" | i18n }}</a
      >
    </div>
  `,
})
export class LoginSecondaryContentComponent {
  registerRouteService = inject(RegisterRouteService);
  serverSettingsService = inject(ServerSettingsService);

  // TODO: remove when email verification flag is removed
  protected registerRoute$ = this.registerRouteService.registerRoute$();

  protected isUserRegistrationDisabled = this.serverSettingsService.isUserRegistrationDisabled$;
}
