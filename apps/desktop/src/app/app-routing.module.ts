import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import { AuthRoute } from "@bitwarden/angular/auth/constants";
import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/environment-selector/environment-selector.component";
import {
  authGuard,
  lockGuard,
  activeAuthGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { LoginViaWebAuthnComponent } from "@bitwarden/angular/auth/login-via-webauthn/login-via-webauthn.component";
import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { SetInitialPasswordComponent } from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.component";
import {
  DevicesIcon,
  RegistrationUserAddIcon,
  TwoFactorTimeoutIcon,
  TwoFactorAuthEmailIcon,
  UserLockIcon,
  VaultIcon,
  LockIcon,
  DomainIcon,
  TwoFactorAuthSecurityKeyIcon,
} from "@bitwarden/assets/svg";
import {
  LoginComponent,
  LoginSecondaryContentComponent,
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  LoginDecryptionOptionsComponent,
  SsoComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
} from "@bitwarden/auth/angular";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "@bitwarden/components";
import { LockComponent, ConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";

import { maxAccountsGuardFn } from "../auth/guards/max-accounts.guard";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import { VaultV2Component } from "../vault/app/vault/vault-v2.component";

import { Fido2PlaceholderComponent } from "./components/fido2placeholder.component";
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
    path: AuthRoute.AuthenticationTimeout,
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
    path: AuthRoute.NewDeviceVerification,
    component: AnonLayoutWrapperComponent,
    canActivate: [unauthGuardFn(), activeAuthGuard()],
    children: [{ path: "", component: NewDeviceVerificationComponent }],
    data: {
      pageIcon: TwoFactorAuthEmailIcon,
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
    path: "passkeys",
    component: Fido2PlaceholderComponent,
  },
  {
    path: "passkeys",
    component: Fido2PlaceholderComponent,
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.LoginWithPasskey,
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: TwoFactorAuthSecurityKeyIcon,
          pageTitle: {
            key: "logInWithPasskey",
          },
          pageSubtitle: {
            key: "readingPasskeyLoadingInfo",
          },
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaWebAuthnComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.SignUp,
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
              loginRoute: `/${AuthRoute.Login}`,
            } satisfies RegistrationStartSecondaryComponentData,
          },
        ],
      },
      {
        path: AuthRoute.FinishSignUp,
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
        ],
      },
      {
        path: AuthRoute.Login,
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
        path: AuthRoute.LoginInitiated,
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
        },
        children: [{ path: "", component: LoginDecryptionOptionsComponent }],
      },
      {
        path: AuthRoute.Sso,
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
        path: AuthRoute.LoginWithDevice,
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
        path: AuthRoute.AdminApprovalRequested,
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
        path: AuthRoute.PasswordHint,
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
        canActivate: [lockGuard()],
        data: {
          pageIcon: LockIcon,
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
        path: AuthRoute.TwoFactor,
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
          // `TwoFactorAuthComponent` manually sets its icon based on the 2fa type
          pageIcon: null,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: AuthRoute.SetInitialPassword,
        canActivate: [authGuard],
        component: SetInitialPasswordComponent,
        data: {
          maxWidth: "lg",
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: AuthRoute.ChangePassword,
        component: ChangePasswordComponent,
        canActivate: [authGuard],
        data: {
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: "confirm-key-connector-domain",
        component: ConfirmKeyConnectorDomainComponent,
        canActivate: [],
        data: {
          pageTitle: {
            key: "confirmKeyConnectorDomain",
          },
          pageIcon: DomainIcon,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
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
