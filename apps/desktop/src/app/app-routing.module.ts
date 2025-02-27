import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import {
  DesktopDefaultOverlayPosition,
  EnvironmentSelectorComponent,
} from "@bitwarden/angular/auth/components/environment-selector.component";
import { unauthUiRefreshSwap } from "@bitwarden/angular/auth/functions/unauth-ui-refresh-route-swap";
import {
  authGuard,
  lockGuard,
  activeAuthGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { NewDeviceVerificationNoticeGuard } from "@bitwarden/angular/vault/guards";
import {
  AnonLayoutWrapperComponent,
  AnonLayoutWrapperData,
  LoginComponent,
  LoginSecondaryContentComponent,
  LockIcon,
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationLockAltIcon,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  RegistrationUserAddIcon,
  SetPasswordJitComponent,
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
import { LockComponent } from "@bitwarden/key-management-ui";
import {
  NewDeviceVerificationNoticePageOneComponent,
  NewDeviceVerificationNoticePageTwoComponent,
  VaultIcons,
} from "@bitwarden/vault";

import { AccessibilityCookieComponent } from "../auth/accessibility-cookie.component";
import { maxAccountsGuardFn } from "../auth/guards/max-accounts.guard";
import { HintComponent } from "../auth/hint.component";
import { LoginDecryptionOptionsComponentV1 } from "../auth/login/login-decryption-options/login-decryption-options-v1.component";
import { LoginComponentV1 } from "../auth/login/login-v1.component";
import { LoginViaAuthRequestComponentV1 } from "../auth/login/login-via-auth-request-v1.component";
import { RemovePasswordComponent } from "../auth/remove-password.component";
import { SetPasswordComponent } from "../auth/set-password.component";
import { SsoComponentV1 } from "../auth/sso-v1.component";
import { TwoFactorComponentV1 } from "../auth/two-factor-v1.component";
import { UpdateTempPasswordComponent } from "../auth/update-temp-password.component";
import { VaultComponent } from "../vault/app/vault/vault.component";

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
  ...unauthUiRefreshSwap(
    TwoFactorComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "2fa",
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
          key: "verifyIdentity",
        },
      } satisfies RouteDataProperties & AnonLayoutWrapperData,
    },
  ),
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
        key: "verifyIdentity",
      },
      pageSubtitle: {
        key: "weDontRecognizeThisDevice",
      },
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
  },
  {
    path: "new-device-notice",
    component: AnonLayoutWrapperComponent,
    canActivate: [],
    children: [
      {
        path: "",
        component: NewDeviceVerificationNoticePageOneComponent,
        data: {
          pageIcon: VaultIcons.ExclamationTriangle,
          pageTitle: {
            key: "importantNotice",
          },
        },
      },
      {
        path: "setup",
        component: NewDeviceVerificationNoticePageTwoComponent,
        data: {
          pageIcon: VaultIcons.UserLock,
          pageTitle: {
            key: "setupTwoStepLogin",
          },
        },
      },
    ],
  },
  {
    path: "vault",
    component: VaultComponent,
    canActivate: [authGuard, NewDeviceVerificationNoticeGuard],
  },
  { path: "accessibility-cookie", component: AccessibilityCookieComponent },
  { path: "set-password", component: SetPasswordComponent },
  ...unauthUiRefreshSwap(
    SsoComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "sso",
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
  ),
  {
    path: "send",
    component: SendComponent,
    canActivate: [authGuard],
  },
  {
    path: "update-temp-password",
    component: UpdateTempPasswordComponent,
    canActivate: [authGuard],
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [authGuard],
  },
  ...unauthUiRefreshSwap(
    LoginViaAuthRequestComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "login-with-device",
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
  ),
  ...unauthUiRefreshSwap(
    LoginViaAuthRequestComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "admin-approval-requested",
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
  ),
  ...unauthUiRefreshSwap(
    HintComponent,
    AnonLayoutWrapperComponent,
    {
      path: "hint",
      canActivate: [unauthGuardFn()],
    },
    {
      path: "",
      children: [
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
      ],
    },
  ),
  ...unauthUiRefreshSwap(
    LoginComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "login",
      component: LoginComponentV1,
      canActivate: [maxAccountsGuardFn()],
    },
    {
      path: "",
      children: [
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
              data: {
                overlayPosition: DesktopDefaultOverlayPosition,
              },
            },
          ],
        },
      ],
    },
  ),
  ...unauthUiRefreshSwap(
    LoginDecryptionOptionsComponentV1,
    AnonLayoutWrapperComponent,
    {
      path: "login-initiated",
      canActivate: [tdeDecryptionRequiredGuard()],
    },
    {
      path: "login-initiated",
      canActivate: [tdeDecryptionRequiredGuard()],
      data: {
        pageIcon: DevicesIcon,
      },
      children: [{ path: "", component: LoginDecryptionOptionsComponent }],
    },
  ),
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
        path: "set-password-jit",
        component: SetPasswordJitComponent,
        data: {
          pageTitle: {
            key: "joinOrganization",
          },
          pageSubtitle: {
            key: "finishJoiningThisOrganizationBySettingAMasterPassword",
          },
        } satisfies AnonLayoutWrapperData,
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
