import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import {
  AuthGuard,
  lockGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
} from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { AccessibilityCookieComponent } from "../auth/accessibility-cookie.component";
import { LoginGuard } from "../auth/guards/login.guard";
import { HintComponent } from "../auth/hint.component";
import { LockComponent } from "../auth/lock.component";
import { LoginDecryptionOptionsComponent } from "../auth/login/login-decryption-options/login-decryption-options.component";
import { LoginWithDeviceComponent } from "../auth/login/login-with-device.component";
import { LoginComponent } from "../auth/login/login.component";
import { RegisterComponent } from "../auth/register.component";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { SsoComponent } from "../auth/sso.component";
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
    canActivate: [LoginGuard],
  },
  {
    path: "login-with-device",
    component: LoginWithDeviceComponent,
  },
  {
    path: "admin-approval-requested",
    component: LoginWithDeviceComponent,
  },
  { path: "2fa", component: TwoFactorComponent },
  {
    path: "login-initiated",
    component: LoginDecryptionOptionsComponent,
    canActivate: [
      tdeDecryptionRequiredGuard(),
      canAccessFeature(FeatureFlag.TrustedDeviceEncryption),
    ],
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
