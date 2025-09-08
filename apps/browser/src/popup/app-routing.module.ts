import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/environment-selector/environment-selector.component";
import {
  activeAuthGuard,
  authGuard,
  lockGuard,
  redirectGuard,
  redirectToVaultIfUnlockedGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { SetInitialPasswordComponent } from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.component";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import {
  DevicesIcon,
  RegistrationLockAltIcon,
  RegistrationUserAddIcon,
  TwoFactorTimeoutIcon,
  DeviceVerificationIcon,
  UserLockIcon,
  VaultIcon,
  LockIcon,
  PhishingLandingIcon,
} from "@bitwarden/assets/svg";
import {
  LoginComponent,
  LoginDecryptionOptionsComponent,
  LoginSecondaryContentComponent,
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  SsoComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
} from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "@bitwarden/components";
import { LockComponent, ConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";

import { AccountSwitcherComponent } from "../auth/popup/account-switching/account-switcher.component";
import { fido2AuthGuard } from "../auth/popup/guards/fido2-auth.guard";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { ExtensionDeviceManagementComponent } from "../auth/popup/settings/extension-device-management.component";
import { Fido2Component } from "../autofill/popup/fido2/fido2.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { BlockedDomainsComponent } from "../autofill/popup/settings/blocked-domains.component";
import { ExcludedDomainsComponent } from "../autofill/popup/settings/excluded-domains.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PremiumV2Component } from "../billing/popup/settings/premium-v2.component";
import { LearnMoreComponent } from "../dirt/phishing-detection/pages/learn-more-component";
import { PhishingWarning } from "../dirt/phishing-detection/pages/phishing-warning.component";
import { RemovePasswordComponent } from "../key-management/key-connector/remove-password.component";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { popupRouterCacheGuard } from "../platform/popup/view-cache/popup-router-cache.service";
import { CredentialGeneratorHistoryComponent } from "../tools/popup/generator/credential-generator-history.component";
import { CredentialGeneratorComponent } from "../tools/popup/generator/credential-generator.component";
import { SendAddEditComponent as SendAddEditV2Component } from "../tools/popup/send-v2/add-edit/send-add-edit.component";
import { SendCreatedComponent } from "../tools/popup/send-v2/send-created/send-created.component";
import { SendV2Component } from "../tools/popup/send-v2/send-v2.component";
import { AboutPageV2Component } from "../tools/popup/settings/about-page/about-page-v2.component";
import { ExportBrowserV2Component } from "../tools/popup/settings/export/export-browser-v2.component";
import { ImportBrowserV2Component } from "../tools/popup/settings/import/import-browser-v2.component";
import { SettingsV2Component } from "../tools/popup/settings/settings-v2.component";
import { AtRiskPasswordsComponent } from "../vault/popup/components/at-risk-passwords/at-risk-passwords.component";
import { AddEditV2Component } from "../vault/popup/components/vault-v2/add-edit/add-edit-v2.component";
import { AssignCollections } from "../vault/popup/components/vault-v2/assign-collections/assign-collections.component";
import { AttachmentsV2Component } from "../vault/popup/components/vault-v2/attachments/attachments-v2.component";
import { IntroCarouselComponent } from "../vault/popup/components/vault-v2/intro-carousel/intro-carousel.component";
import { PasswordHistoryV2Component } from "../vault/popup/components/vault-v2/vault-password-history-v2/vault-password-history-v2.component";
import { VaultV2Component } from "../vault/popup/components/vault-v2/vault-v2.component";
import { ViewV2Component } from "../vault/popup/components/vault-v2/view-v2/view-v2.component";
import { canAccessAtRiskPasswords } from "../vault/popup/guards/at-risk-passwords.guard";
import { clearVaultStateGuard } from "../vault/popup/guards/clear-vault-state.guard";
import { IntroCarouselGuard } from "../vault/popup/guards/intro-carousel.guard";
import { AppearanceV2Component } from "../vault/popup/settings/appearance-v2.component";
import { DownloadBitwardenComponent } from "../vault/popup/settings/download-bitwarden.component";
import { FoldersV2Component } from "../vault/popup/settings/folders-v2.component";
import { MoreFromBitwardenPageV2Component } from "../vault/popup/settings/more-from-bitwarden-page-v2.component";
import { TrashComponent } from "../vault/popup/settings/trash.component";
import { VaultSettingsV2Component } from "../vault/popup/settings/vault-settings-v2.component";

import { RouteElevation } from "./app-routing.animations";
import {
  ExtensionAnonLayoutWrapperComponent,
  ExtensionAnonLayoutWrapperData,
} from "./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
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
      redirectGuard({ loggedIn: "/tabs/current", loggedOut: "/login", locked: "/lock" }),
    ],
  },
  {
    path: "home",
    redirectTo: "login",
    pathMatch: "full",
  },
  {
    path: "vault",
    redirectTo: "/tabs/vault",
    pathMatch: "full",
  },
  {
    path: "fido2",
    component: Fido2Component,
    canActivate: [fido2AuthGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
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
    path: "device-verification",
    component: ExtensionAnonLayoutWrapperComponent,
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
      showBackButton: true,
      elevation: 1,
    } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [authGuard],
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
    path: "device-management",
    component: ExtensionDeviceManagementComponent,
    canActivate: [canAccessFeature(FeatureFlag.PM14938_BrowserExtensionLoginApproval), authGuard],
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
        path: "set-initial-password",
        canActivate: [authGuard],
        component: SetInitialPasswordComponent,
        data: {
          elevation: 1,
        } satisfies RouteDataProperties,
      },
      {
        path: "login",
        canActivate: [unauthGuardFn(unauthRouteOverrides), IntroCarouselGuard],
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
          },
        ],
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
          },
        ],
      },
      {
        path: "login-with-device",
        canActivate: [redirectToVaultIfUnlockedGuard()],
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "logInRequestSent",
          },
          pageSubtitle: {
            key: "aNotificationWasSentToYourDevice",
          },
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
          },
        ],
      },
      {
        path: "admin-approval-requested",
        canActivate: [redirectToVaultIfUnlockedGuard()],
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
      {
        path: "login-initiated",
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
          showAcctSwitcher: true,
        } satisfies ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: LoginDecryptionOptionsComponent }],
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
            key: "verifyYourIdentity",
          },
          showBackButton: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
      },
      {
        path: "change-password",
        data: {
          elevation: 1,
          hideFooter: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: ChangePasswordComponent,
          },
        ],
        canActivate: [authGuard],
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
    path: "download-bitwarden",
    component: DownloadBitwardenComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "intro-carousel",
    component: ExtensionAnonLayoutWrapperComponent,
    canActivate: [],
    data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        component: IntroCarouselComponent,
        data: {
          hideIcon: true,
          hideFooter: true,
        },
      },
    ],
  },
  {
    path: "confirm-key-connector-domain",
    component: ExtensionAnonLayoutWrapperComponent,
    canActivate: [],
    data: { elevation: 1 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        component: ConfirmKeyConnectorDomainComponent,
        data: {
          pageTitle: {
            key: "confirmKeyConnectorDomain",
          },
          showBackButton: true,
        } satisfies ExtensionAnonLayoutWrapperData,
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
        canActivate: [authGuard],
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
  {
    path: "security",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "phishing-warning",
        children: [
          {
            path: "",
            component: PhishingWarning,
          },
          {
            path: "",
            component: LearnMoreComponent,
            outlet: "secondary",
          },
        ],
        data: {
          pageIcon: PhishingLandingIcon,
          pageTitle: "Bitwarden blocked it!",
          pageSubtitle: "Bitwarden blocked a known phishing site from loading.",
          showReadonlyHostname: true,
        } satisfies AnonLayoutWrapperData,
      },
    ],
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
