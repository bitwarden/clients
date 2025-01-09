import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RegisterRouteService } from "@bitwarden/auth/common";
import { DefaultServerSettingsService } from "@bitwarden/common/platform/services/default-server-settings.service";
import { LinkModule } from "@bitwarden/components";

@Component({
  standalone: true,
  imports: [CommonModule, JslibModule, LinkModule, RouterModule],
  template: `
    <div class="tw-text-center" *ngIf="!(isUserRegistrationDisabled$ | async)">
      {{ "newToBitwarden" | i18n }}
      <a bitLink [routerLink]="registerRoute$ | async">{{ "createAccount" | i18n }}</a>
    </div>
  `,
})
export class LoginSecondaryContentComponent {
  registerRouteService = inject(RegisterRouteService);
  serverSettingsService = inject(DefaultServerSettingsService);

  // TODO: remove when email verification flag is removed
  protected registerRoute$ = this.registerRouteService.registerRoute$();

  protected isUserRegistrationDisabled$ = this.serverSettingsService.isUserRegistrationDisabled$;
}
