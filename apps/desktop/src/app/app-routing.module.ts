import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/environment-selector/environment-selector.component";
import {
  authGuard,
  lockGuard,
  activeAuthGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import {
  LoginComponent,
  LoginSecondaryContentComponent,
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationLockAltIcon,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  RegistrationUserAddIcon,
  UserLockIcon,
  VaultIcon,
  LoginDecryptionOptionsComponent,
  DevicesIcon,
  SsoComponent,
  TwoFactorTimeoutIcon,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
  DeviceVerificationIcon,
} from "@bitwarden/auth/angular";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData, Icons } from "@bitwarden/components";
import { LockComponent } from "@bitwarden/key-management-ui";

import { maxAccountsGuardFn } from "../auth/guards/max-accounts.guard";
import { reactiveUnlockVaultGuard } from "../autofill/guards/reactive-vault-guard";
import { Fido2CreateComponent } from "../autofill/modal/credentials/fido2-create.component";
import { Fido2ExcludedCiphersComponent } from "../autofill/modal/credentials/fido2-excluded-ciphers.component";
import { Fido2VaultComponent } from "../autofill/modal/credentials/fido2-vault.component";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import { VaultV2Component } from "../vault/app/vault/vault-v2.component";

import { SendComponent } from "./tools/send/send.component";

/**
 * Data properties acceptable for use in route objects in the desktop
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouteDataProperties {
  // For any new route data properties, add them here.
  // then assert that the data object satisfies this interface in the route object.
}

const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [], // Children lets us have an empty component.
    canActivate: [redirectGuard({ loggedIn: "/vault", loggedOut: "/login", locked: "/lock" })],
  },
  {
    path: "authentication-timeout",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "",
        component: AuthenticationTimeoutComponent,
      },
    ],
    data: {
      pageIcon: TwoFactorTimeoutIcon,
      pageTitle: {
        key: "authenticationTimeout",
      },
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
  },
  {
    path: "device-verification",
    component: AnonLayoutWrapperComponent,
    canActivate: [unauthGuardFn(), activeAuthGuard()],
    children: [{ path: "", component: NewDeviceVerificationComponent }],
    data: {
      pageIcon: DeviceVerificationIcon,
      pageTitle: {
        key: "verifyYourIdentity",
      },
      pageSubtitle: {
        key: "weDontRecognizeThisDevice",
      },
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
  },
  {
    path: "vault",
    component: VaultV2Component,
    canActivate: [authGuard],
  },
  {
    path: "send",
    component: SendComponent,
    canActivate: [authGuard],
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [authGuard],
  },
  {
    path: "fido2-assertion",
    component: Fido2VaultComponent,
  },
  {
    path: "fido2-creation",
    component: Fido2CreateComponent,
  },
  {
    path: "fido2-excluded",
    component: Fido2ExcludedCiphersComponent,
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "signup",
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: RegistrationUserAddIcon,
          pageTitle: {
            key: "createAccount",
          },
        } satisfies AnonLayoutWrapperData,
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
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: RegistrationLockAltIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
        ],
      },
      {
        path: "login",
        canActivate: [maxAccountsGuardFn()],
        data: {
          pageTitle: {
            key: "logInToBitwarden",
          },
          pageIcon: VaultIcon,
        },
        children: [
          { path: "", component: LoginComponent },
          { path: "", component: LoginSecondaryContentComponent, outlet: "secondary" },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "login-initiated",
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
        },
        children: [{ path: "", component: LoginDecryptionOptionsComponent }],
      },
      {
        path: "sso",
        data: {
          pageIcon: VaultIcon,
          pageTitle: {
            key: "enterpriseSingleSignOn",
          },
          pageSubtitle: {
            key: "singleSignOnEnterOrgIdentifierText",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: SsoComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "login-with-device",
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "logInRequestSent",
          },
          pageSubtitle: {
            key: "aNotificationWasSentToYourDevice",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaAuthRequestComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "admin-approval-requested",
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "adminApprovalRequested",
          },
          pageSubtitle: {
            key: "adminApprovalRequestSentToAdmins",
          },
        } satisfies AnonLayoutWrapperData,
        children: [{ path: "", component: LoginViaAuthRequestComponent }],
      },
      {
        path: "hint",
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "requestPasswordHint",
          },
          pageSubtitle: {
            key: "enterYourAccountEmailAddressAndYourPasswordHintWillBeSentToYou",
          },
          pageIcon: UserLockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: PasswordHintComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "lock",
        canActivate: [lockGuard(), reactiveUnlockVaultGuard],
        data: {
          pageIcon: Icons.LockIcon,
          pageTitle: {
            key: "yourVaultIsLockedV2",
          },
          showReadonlyHostname: true,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: LockComponent,
          },
        ],
      },
      {
        path: "2fa",
        canActivate: [unauthGuardFn(), TwoFactorAuthGuard],
        children: [
          {
            path: "",
            component: TwoFactorAuthComponent,
          },
        ],
        data: {
          pageTitle: {
            key: "verifyYourIdentity",
          },
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: "change-password",
        component: ChangePasswordComponent,
        canActivate: [authGuard],
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      // enableTracing: true,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
