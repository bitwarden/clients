import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import {
  EnvironmentSelectorComponent,
  EnvironmentSelectorRouteData,
  ExtensionDefaultOverlayPosition,
} from "@bitwarden/angular/auth/components/environment-selector.component";
import { unauthUiRefreshRedirect } from "@bitwarden/angular/auth/functions/unauth-ui-refresh-redirect";
import { unauthUiRefreshSwap } from "@bitwarden/angular/auth/functions/unauth-ui-refresh-route-swap";
import {
  activeAuthGuard,
  authGuard,
  lockGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { NewDeviceVerificationNoticeGuard } from "@bitwarden/angular/vault/guards";
import {
  AnonLayoutWrapperComponent,
  AnonLayoutWrapperData,
  DevicesIcon,
  LockIcon,
  LoginComponent,
  LoginDecryptionOptionsComponent,
  LoginSecondaryContentComponent,
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationLockAltIcon,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  RegistrationUserAddIcon,
  SetPasswordJitComponent,
  SsoComponent,
  TwoFactorTimeoutIcon,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
  DeviceVerificationIcon,
  UserLockIcon,
  VaultIcon,
} from "@bitwarden/auth/angular";
import { LockComponent } from "@bitwarden/key-management-ui";
import {
  NewDeviceVerificationNoticePageOneComponent,
  NewDeviceVerificationNoticePageTwoComponent,
  VaultIcons,
} from "@bitwarden/vault";

import { fido2AuthGuard } from "../auth/guards/fido2-auth.guard";
import { AccountSwitcherComponent } from "../auth/popup/account-switching/account-switcher.component";
import { EnvironmentComponent } from "../auth/popup/environment.component";
import {
  ExtensionAnonLayoutWrapperComponent,
  ExtensionAnonLayoutWrapperData,
} from "../auth/popup/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
import { HintComponent } from "../auth/popup/hint.component";
import { HomeComponent } from "../auth/popup/home.component";
import { LoginDecryptionOptionsComponentV1 } from "../auth/popup/login-decryption-options/login-decryption-options-v1.component";
import { LoginComponentV1 } from "../auth/popup/login-v1.component";
import { LoginViaAuthRequestComponentV1 } from "../auth/popup/login-via-auth-request-v1.component";
import { RemovePasswordComponent } from "../auth/popup/remove-password.component";
import { SetPasswordComponent } from "../auth/popup/set-password.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { SsoComponentV1 } from "../auth/popup/sso-v1.component";
import { TwoFactorOptionsComponentV1 } from "../auth/popup/two-factor-options-v1.component";
import { TwoFactorComponentV1 } from "../auth/popup/two-factor-v1.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { Fido2Component } from "../autofill/popup/fido2/fido2.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { BlockedDomainsComponent } from "../autofill/popup/settings/blocked-domains.component";
import { ExcludedDomainsComponent } from "../autofill/popup/settings/excluded-domains.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PremiumV2Component } from "../billing/popup/settings/premium-v2.component";
import BrowserPopupUtils from "../platform/popup/browser-popup-utils";
import { popupRouterCacheGuard } from "../platform/popup/view-cache/popup-router-cache.service";
import { CredentialGeneratorHistoryComponent } from "../tools/popup/generator/credential-generator-history.component";
import { CredentialGeneratorComponent } from "../tools/popup/generator/credential-generator.component";
import { SendAddEditComponent as SendAddEditV2Component } from "../tools/popup/send-v2/add-edit/send-add-edit.component";
import { SendCreatedComponent } from "../tools/popup/send-v2/send-created/send-created.component";
import { SendV2Component } from "../tools/popup/send-v2/send-v2.component";
import { AboutPageV2Component } from "../tools/popup/settings/about-page/about-page-v2.component";
import { MoreFromBitwardenPageV2Component } from "../tools/popup/settings/about-page/more-from-bitwarden-page-v2.component";
import { ExportBrowserV2Component } from "../tools/popup/settings/export/export-browser-v2.component";
import { ImportBrowserV2Component } from "../tools/popup/settings/import/import-browser-v2.component";
import { SettingsV2Component } from "../tools/popup/settings/settings-v2.component";
import { canAccessAtRiskPasswords } from "../vault/guards/at-risk-passwords.guard";
import { clearVaultStateGuard } from "../vault/guards/clear-vault-state.guard";
import { AtRiskPasswordsComponent } from "../vault/popup/components/at-risk-passwords/at-risk-passwords.component";
import { AddEditV2Component } from "../vault/popup/components/vault-v2/add-edit/add-edit-v2.component";
import { AssignCollections } from "../vault/popup/components/vault-v2/assign-collections/assign-collections.component";
import { AttachmentsV2Component } from "../vault/popup/components/vault-v2/attachments/attachments-v2.component";
import { PasswordHistoryV2Component } from "../vault/popup/components/vault-v2/vault-password-history-v2/vault-password-history-v2.component";
import { VaultV2Component } from "../vault/popup/components/vault-v2/vault-v2.component";
import { ViewV2Component } from "../vault/popup/components/vault-v2/view-v2/view-v2.component";
import { AppearanceV2Component } from "../vault/popup/settings/appearance-v2.component";
import { FoldersV2Component } from "../vault/popup/settings/folders-v2.component";
import { TrashComponent } from "../vault/popup/settings/trash.component";
import { VaultSettingsV2Component } from "../vault/popup/settings/vault-settings-v2.component";

import { RouteElevation } from "./app-routing.animations";
import { debounceNavigationGuard } from "./services/debounce-navigation.service";
import { TabsV2Component } from "./tabs-v2.component";

/**
 * Data properties acceptable for use in extension route objects
 */
export interface RouteDataProperties {
  elevation: RouteElevation;

  /**
   * A boolean to indicate that the URL should not be saved in memory in the BrowserRouterService.
   */
  doNotSaveUrl?: boolean;
}

const unauthRouteOverrides = {
  homepage: () => {
    return BrowserPopupUtils.inPopout(window) ? "/tabs/vault" : "/tabs/current";
  },
};

const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [], // Children lets us have an empty component.
    canActivate: [
      popupRouterCacheGuard,
      redirectGuard({ loggedIn: "/tabs/current", loggedOut: "/home", locked: "/lock" }),
    ],
  },
  {
    path: "vault",
    redirectTo: "/tabs/vault",
    pathMatch: "full",
  },
  {
    path: "home",
    component: HomeComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides), unauthUiRefreshRedirect("/login")],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "fido2",
    component: Fido2Component,
    canActivate: [fido2AuthGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...unauthUiRefreshSwap(
    TwoFactorComponentV1,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { elevation: 1 } satisfies RouteDataProperties,
    },
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides), TwoFactorAuthGuard],
      children: [
        {
          path: "",
          component: TwoFactorAuthComponent,
        },
      ],
      data: {
        elevation: 1,
        pageTitle: {
          key: "verifyIdentity",
        },
        showBackButton: true,
      } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
    },
  ),
  {
    path: "",
    component: ExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: "authentication-timeout",
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        children: [
          {
            path: "",
            component: AuthenticationTimeoutComponent,
          },
        ],
        data: {
          pageTitle: {
            key: "authenticationTimeout",
          },
          pageIcon: TwoFactorTimeoutIcon,
          elevation: 1,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "2fa-options",
    component: TwoFactorOptionsComponentV1,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...unauthUiRefreshSwap(
    SsoComponentV1,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "sso",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { elevation: 1 } satisfies RouteDataProperties,
    },
    {
      path: "sso",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: {
        pageIcon: VaultIcon,
        pageTitle: {
          key: "enterpriseSingleSignOn",
        },
        pageSubtitle: {
          key: "singleSignOnEnterOrgIdentifierText",
        },
        elevation: 1,
      } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
      children: [
        { path: "", component: SsoComponent },
        {
          path: "",
          component: EnvironmentSelectorComponent,
          outlet: "environment-selector",
          data: {
            overlayPosition: ExtensionDefaultOverlayPosition,
          } satisfies EnvironmentSelectorRouteData,
        },
      ],
    },
  ),
  {
    path: "device-verification",
    component: ExtensionAnonLayoutWrapperComponent,
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
      showBackButton: true,
      elevation: 1,
    } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
  },
  {
    path: "set-password",
    component: SetPasswordComponent,
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "environment",
    component: EnvironmentComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "view-cipher",
    component: ViewV2Component,
    canActivate: [authGuard],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
  },
  {
    path: "cipher-password-history",
    component: PasswordHistoryV2Component,
    canActivate: [authGuard],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "add-cipher",
    component: AddEditV2Component,
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { elevation: 1 } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "edit-cipher",
    component: AddEditV2Component,
    canActivate: [authGuard, debounceNavigationGuard()],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "attachments",
    component: AttachmentsV2Component,
    canActivate: [authGuard],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "generator",
    component: CredentialGeneratorComponent,
    canActivate: [authGuard],
    data: { elevation: 0 } satisfies RouteDataProperties,
  },
  {
    path: "generator-history",
    component: CredentialGeneratorHistoryComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "import",
    component: ImportBrowserV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "export",
    component: ExportBrowserV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "autofill",
    component: AutofillComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "account-security",
    component: AccountSecurityComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "notifications",
    component: NotificationsSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "vault-settings",
    component: VaultSettingsV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "folders",
    component: FoldersV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "blocked-domains",
    component: BlockedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "excluded-domains",
    component: ExcludedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "premium",
    component: PremiumV2Component,
    canActivate: [authGuard],
    data: { elevation: 3 } satisfies RouteDataProperties,
  },
  {
    path: "appearance",
    component: AppearanceV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "clone-cipher",
    component: AddEditV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "add-send",
    component: SendAddEditV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "edit-send",
    component: SendAddEditV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "send-created",
    component: SendCreatedComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "update-temp-password",
    component: UpdateTempPasswordComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...unauthUiRefreshSwap(
    LoginViaAuthRequestComponentV1,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "login-with-device",
      data: { elevation: 1 } satisfies RouteDataProperties,
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
        showLogo: false,
        showBackButton: true,
        elevation: 1,
      } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
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
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "admin-approval-requested",
      data: { elevation: 1 } satisfies RouteDataProperties,
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
        showLogo: false,
        showBackButton: true,
        elevation: 1,
      } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
      children: [{ path: "", component: LoginViaAuthRequestComponent }],
    },
  ),
  ...unauthUiRefreshSwap(
    HintComponent,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "hint",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: {
        elevation: 1,
      } satisfies RouteDataProperties,
    },
    {
      path: "",
      children: [
        {
          path: "hint",
          canActivate: [unauthGuardFn(unauthRouteOverrides)],
          data: {
            pageTitle: {
              key: "requestPasswordHint",
            },
            pageSubtitle: {
              key: "enterYourAccountEmailAddressAndYourPasswordHintWillBeSentToYou",
            },
            pageIcon: UserLockIcon,
            showBackButton: true,
            elevation: 1,
          } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
          children: [
            { path: "", component: PasswordHintComponent },
            {
              path: "",
              component: EnvironmentSelectorComponent,
              outlet: "environment-selector",
              data: {
                overlayPosition: ExtensionDefaultOverlayPosition,
              } satisfies EnvironmentSelectorRouteData,
            },
          ],
        },
      ],
    },
  ),
  ...unauthUiRefreshSwap(
    LoginComponentV1,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "login",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { elevation: 1 },
    },
    {
      path: "",
      children: [
        {
          path: "login",
          canActivate: [unauthGuardFn(unauthRouteOverrides)],
          data: {
            pageIcon: VaultIcon,
            pageTitle: {
              key: "logInToBitwarden",
            },
            elevation: 1,
            showAcctSwitcher: true,
          } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
          children: [
            { path: "", component: LoginComponent },
            { path: "", component: LoginSecondaryContentComponent, outlet: "secondary" },
            {
              path: "",
              component: EnvironmentSelectorComponent,
              outlet: "environment-selector",
              data: {
                overlayPosition: ExtensionDefaultOverlayPosition,
              } satisfies EnvironmentSelectorRouteData,
            },
          ],
        },
      ],
    },
  ),
  ...unauthUiRefreshSwap(
    LoginDecryptionOptionsComponentV1,
    ExtensionAnonLayoutWrapperComponent,
    {
      path: "login-initiated",
      canActivate: [tdeDecryptionRequiredGuard()],
      data: { elevation: 1 } satisfies RouteDataProperties,
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
    component: ExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: "signup",
        canActivate: [unauthGuardFn()],
        data: {
          elevation: 1,
          pageIcon: RegistrationUserAddIcon,
          pageTitle: {
            key: "createAccount",
          },
          showBackButton: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
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
              loginRoute: "/home",
            } satisfies RegistrationStartSecondaryComponentData,
          },
        ],
      },
      {
        path: "finish-signup",
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: RegistrationLockAltIcon,
          elevation: 1,
          showBackButton: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
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
          showAcctSwitcher: true,
          elevation: 1,
          /**
           * This ensures that in a passkey flow the `/fido2?<queryParams>` URL does not get
           * overwritten in the `BrowserRouterService` by the `/lock` route. This way, after
           * unlocking, the user can be redirected back to the `/fido2?<queryParams>` URL.
           *
           * Also, this prevents a routing loop when using biometrics to unlock the vault in MV2 (Firefox),
           * locking up the browser (https://bitwarden.atlassian.net/browse/PM-16116). This involves the
           * `popup-router-cache.service` pushing the `lock` route to the history.
           */
          doNotSaveUrl: true,
        } satisfies ExtensionAnonLayoutWrapperData & RouteDataProperties,
        children: [
          {
            path: "",
            component: LockComponent,
          },
        ],
      },
    ],
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
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
          elevation: 1,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "assign-collections",
    component: AssignCollections,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "about",
    component: AboutPageV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "more-from-bitwarden",
    component: MoreFromBitwardenPageV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "new-device-notice",
    component: ExtensionAnonLayoutWrapperComponent,
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
          hideFooter: true,
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
    path: "tabs",
    component: TabsV2Component,
    data: { elevation: 0 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        redirectTo: "/tabs/vault",
        pathMatch: "full",
      },
      {
        path: "current",
        redirectTo: "/tabs/vault",
      },
      {
        path: "vault",
        component: VaultV2Component,
        canActivate: [authGuard, NewDeviceVerificationNoticeGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "generator",
        component: CredentialGeneratorComponent,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "settings",
        component: SettingsV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "send",
        component: SendV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
    ],
  },
  {
    path: "at-risk-passwords",
    component: AtRiskPasswordsComponent,
    canActivate: [authGuard, canAccessAtRiskPasswords],
  },
  {
    path: "account-switcher",
    component: AccountSwitcherComponent,
    data: { elevation: 4, doNotSaveUrl: true } satisfies RouteDataProperties,
  },
  {
    path: "trash",
    component: TrashComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
];

@Injectable()
export class NoRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(route: ActivatedRouteSnapshot) {
    return false;
  }

  // eslint-disable-next-line
  store(route: ActivatedRouteSnapshot, handle: {}) {
    /* Nothing */
  }

  shouldAttach(route: ActivatedRouteSnapshot) {
    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): any {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot) {
    return false;
  }
}

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      onSameUrlNavigation: "reload",
      /*enableTracing: true,*/
    }),
  ],
  exports: [RouterModule],
  providers: [{ provide: RouteReuseStrategy, useClass: NoRouteReuseStrategy }],
})
export class AppRoutingModule {}
