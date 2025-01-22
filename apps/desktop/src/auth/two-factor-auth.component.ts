import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthAuthenticatorComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-authenticator.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthEmailComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-email.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthWebAuthnComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-webauthn.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthYubikeyComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-yubikey.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthComponent as BaseTwoFactorAuthComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorOptionsComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-options.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { JslibModule } from "../../../../libs/angular/src/jslib.module";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { AsyncActionsModule } from "../../../../libs/components/src/async-actions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { ButtonModule } from "../../../../libs/components/src/button";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { CheckboxModule } from "../../../../libs/components/src/checkbox";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { FormFieldModule } from "../../../../libs/components/src/form-field";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { LinkModule } from "../../../../libs/components/src/link";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TypographyModule } from "../../../../libs/components/src/typography";

import { TwoFactorAuthDuoComponent } from "./two-factor-auth-duo.component";

@Component({
  standalone: true,
  templateUrl:
    "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth.component.html",
  selector: "app-two-factor-auth",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    RouterLink,
    CheckboxModule,
    TwoFactorOptionsComponent,
    TwoFactorAuthEmailComponent,
    TwoFactorAuthAuthenticatorComponent,
    TwoFactorAuthYubikeyComponent,
    TwoFactorAuthDuoComponent,
    TwoFactorAuthWebAuthnComponent,
  ],
})
export class TwoFactorAuthComponent extends BaseTwoFactorAuthComponent {}
