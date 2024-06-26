import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import {
  AuthGuard,
  lockGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import {
  AnonLayoutWrapperComponent,
  AnonLayoutWrapperData,
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
} from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { twofactorRefactorSwap } from "../../../../libs/angular/src/utils/two-factor-component-refactor-route-swap";
import { AccessibilityCookieComponent } from "../auth/accessibility-cookie.component";
import { maxAccountsGuardFn } from "../auth/guards/max-accounts.guard";
import { HintComponent } from "../auth/hint.component";
import { LockComponent } from "../auth/lock.component";
import { LoginDecryptionOptionsComponent } from "../auth/login/login-decryption-options/login-decryption-options.component";
import { LoginViaAuthRequestComponent } from "../auth/login/login-via-auth-request.component";
import { LoginComponent } from "../auth/login/login.component";
import { RegisterComponent } from "../auth/register.component";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { SsoComponent } from "../auth/sso.component";
import { TwoFactorAuthComponent } from "../auth/two-factor-auth.component";
import { TwoFactorComponent } from "../auth/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { VaultComponent } from "../vault/app/vault/vault.component";

import { SendComponent } from "./tools/send/send.component";

const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [], // Children lets us have an empty component.
    canActivate: [redirectGuard({ loggedIn: "/vault", loggedOut: "/login", locked: "/lock" })],
  },
  {
    path: "lock",
    component: LockComponent,
    canActivate: [lockGuard()],
  },
  {
    path: "login",
    component: LoginComponent,
    canActivate: [maxAccountsGuardFn()],
  },
  {
    path: "login-with-device",
    component: LoginViaAuthRequestComponent,
  },
  {
    path: "admin-approval-requested",
    component: LoginViaAuthRequestComponent,
  },
  ...twofactorRefactorSwap(
    TwoFactorComponent,
    AnonLayoutWrapperComponent,
    {
      path: "2fa",
    },
    {
      path: "2fa",
      component: AnonLayoutWrapperComponent,
      children: [
        {
          path: "",
          component: TwoFactorAuthComponent,
          canActivate: [unauthGuardFn()],
        },
      ],
    },
  ),
  {
    path: "login-initiated",
    component: LoginDecryptionOptionsComponent,
    canActivate: [tdeDecryptionRequiredGuard()],
  },
  { path: "register", component: RegisterComponent },
  {
    path: "vault",
    component: VaultComponent,
    canActivate: [AuthGuard],
  },
  { path: "accessibility-cookie", component: AccessibilityCookieComponent },
  { path: "hint", component: HintComponent },
  { path: "set-password", component: SetPasswordComponent },
  { path: "sso", component: SsoComponent },
  {
    path: "send",
    component: SendComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "update-temp-password",
    component: UpdateTempPasswordComponent,
    canActivate: [AuthGuard],
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [AuthGuard],
    data: { titleId: "removeMasterPassword" },
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "signup",
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification), unauthGuardFn()],
        data: { pageTitle: "createAccount" } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationStartComponent,
          },
          {
            path: "",
            component: RegistrationStartSecondaryComponent,
            outlet: "secondary",
            data: {
              loginRoute: "/login",
            } satisfies RegistrationStartSecondaryComponentData,
          },
        ],
      },
      {
        path: "finish-signup",
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification), unauthGuardFn()],
        data: {
          pageTitle: "setAStrongPassword",
          pageSubtitle: "finishCreatingYourAccountBySettingAPassword",
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      /*enableTracing: true,*/
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
