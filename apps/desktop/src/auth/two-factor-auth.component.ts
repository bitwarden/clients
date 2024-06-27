import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { TwoFactorAuthAuthenticatorComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-authenticator.component";
import { TwoFactorAuthEmailComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-email.component";
import { TwoFactorAuthWebAuthnComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-webauthn.component";
import { TwoFactorAuthYubikeyComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-yubikey.component";
import { TwoFactorAuthComponent as BaseTwoFactorAuthComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth.component";
import { TwoFactorOptionsComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-options.component";
import { JslibModule } from "../../../../libs/angular/src/jslib.module";
import { AsyncActionsModule } from "../../../../libs/components/src/async-actions";
import { ButtonModule } from "../../../../libs/components/src/button";
import { CheckboxModule } from "../../../../libs/components/src/checkbox";
import { FormFieldModule } from "../../../../libs/components/src/form-field";
import { LinkModule } from "../../../../libs/components/src/link";
import { I18nPipe } from "../../../../libs/components/src/shared/i18n.pipe";
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
  providers: [I18nPipe],
})
export class TwoFactorAuthComponent extends BaseTwoFactorAuthComponent {}
