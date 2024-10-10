import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RegisterRouteService } from "@bitwarden/auth/common";

@Component({
  standalone: true,
  imports: [CommonModule, JslibModule, RouterModule],
  template: `
    <div class="tw-text-center">
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

  // TODO: remove when email verification flag is removed
  protected registerRoute$ = this.registerRouteService.registerRoute$();
}
