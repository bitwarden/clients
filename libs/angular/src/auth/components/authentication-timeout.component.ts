import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule } from "@bitwarden/components";

/**
 * This component is used to display a message to the user that their authentication session has expired.
 * It provides a button to navigate to the login page.
 */
@Component({
  selector: "app-authentication-timeout",
  imports: [CommonModule, JslibModule, ButtonModule, RouterModule],
  template: `
    <p class="tw-text-center">
      {{ "authenticationSessionTimedOut" | i18n }}
    </p>
    <a routerLink="/login" bitButton block buttonType="primary">
      {{ "logIn" | i18n }}
    </a>
  `,
})
export class AuthenticationTimeoutComponent {}
