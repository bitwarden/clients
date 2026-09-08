import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import { AuthRoute } from "@bitwarden/angular/auth/constants";
import {
  activeAuthGuard,
  authGuard,
  hasPasswordGuard,
  lockGuard,
  redirectGuard,
  redirectToVaultIfUnlockedGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import {
  DevicesIcon,
  TwoFactorTimeoutIcon,
  TwoFactorAuthEmailIcon,
  UserLockIcon,
  VaultIcon,
  LockIcon,
  DomainIcon,
} from "@bitwarden/assets/svg";
import {
  LoginComponent,
  LoginDecryptionOptionsComponent,
  LoginSecondaryContentComponent,
  LoginViaAuthRequestComponent,
  NewDeviceVerificationComponent,
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  SsoComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
} from "@bitwarden/auth/angular";
import { canAccessAutoConfirmSettings } from "@bitwarden/auto-confirm/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "@bitwarden/components";

import { AuthExtensionRoute } from "../auth/popup/constants/auth-extension-route.constant";
import { fido2AuthGuard } from "../auth/popup/guards/fido2-auth.guard";
import { platformPopoutGuard } from "../auth/popup/guards/platform-popout.guard";
import { autofillToolsDevFlagGuard } from "../autofill/popup/autofill-tools/autofill-tools.guard";
import { DefaultPasswordManagerPromptGuard } from "../autofill/popup/default-password-manager/default-password-manager-prompt.guard";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { popupRouterCacheGuard } from "../platform/popup/view-cache/popup-router-cache.service";
import { RouteCacheOptions } from "../platform/services/popup-view-cache-background.service";
import { filePickerPopoutGuard } from "../tools/popup/guards/file-picker-popout.guard";
import {
  atRiskPasswordAuthGuard,
  canAccessAtRiskPasswords,
  hasAtRiskPasswords,
} from "../vault/popup/guards/at-risk-passwords.guard";
import { clearVaultStateGuard } from "../vault/popup/guards/clear-vault-state.guard";
import { IntroCarouselGuard } from "../vault/popup/guards/intro-carousel.guard";

import { RouteElevation } from "./app-routing.animations";
// Type-only: the component itself is lazily loaded below, and importing it here for its value
// would put it (and its layout dependencies) back on the popup's startup path.
import type { ExtensionAnonLayoutWrapperData } from "./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
import { debounceNavigationGuard } from "./services/debounce-navigation.service";

/**
 * Lazily loaded route components.
 *
 * Components reached through a barrel-only path mapping (`@bitwarden/auth/angular`,
 * `@bitwarden/components`) are deliberately absent: this module also needs guards and types
 * from those same barrels synchronously, so webpack keeps them in the initial chunk regardless
 * and a dynamic import would only add indirection.
 */
const loadFido2Component = () =>
  import("../autofill/popup/fido2/fido2.component").then((m) => m.Fido2Component);
const loadExtensionAnonLayoutWrapperComponent = () =>
  import("./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component").then(
    (m) => m.ExtensionAnonLayoutWrapperComponent,
  );
const loadViewComponent = () =>
  import("../vault/popup/components/vault/view/view.component").then((m) => m.ViewComponent);
const loadPasswordHistoryComponent = () =>
  import("../vault/popup/components/vault/vault-password-history/vault-password-history.component").then(
    (m) => m.PasswordHistoryComponent,
  );
const loadNewItemPageComponent = () =>
  import("../vault/popup/components/vault/new-item-page/new-item-page.component").then(
    (m) => m.NewItemPageComponent,
  );
const loadAddEditComponent = () =>
  import("../vault/popup/components/vault/add-edit/add-edit.component").then(
    (m) => m.AddEditComponent,
  );
const loadAttachmentsComponent = () =>
  import("../vault/popup/components/vault/attachments/attachments.component").then(
    (m) => m.AttachmentsComponent,
  );
const loadCredentialGeneratorComponent = () =>
  import("../tools/popup/generator/credential-generator.component").then(
    (m) => m.CredentialGeneratorComponent,
  );
const loadCredentialGeneratorHistoryComponent = () =>
  import("../tools/popup/generator/credential-generator-history.component").then(
    (m) => m.CredentialGeneratorHistoryComponent,
  );
const loadExportBrowserV2Component = () =>
  import("../tools/popup/settings/export/export-browser-v2.component").then(
    (m) => m.ExportBrowserV2Component,
  );
const loadAutofillComponent = () =>
  import("../autofill/popup/settings/autofill.component").then((m) => m.AutofillComponent);
const loadAccountSecurityComponent = () =>
  import("../auth/popup/settings/account-security.component").then(
    (m) => m.AccountSecurityComponent,
  );
const loadChangePasswordPageComponent = () =>
  import("../auth/popup/settings/change-password-page.component").then(
    (m) => m.ChangePasswordPageComponent,
  );
const loadExtensionDeviceManagementComponent = () =>
  import("../auth/popup/settings/extension-device-management.component").then(
    (m) => m.ExtensionDeviceManagementComponent,
  );
const loadNotificationsSettingsComponent = () =>
  import("../autofill/popup/settings/notifications.component").then(
    (m) => m.NotificationsSettingsComponent,
  );
const loadVaultSettingsComponent = () =>
  import("../vault/popup/settings/vault-settings.component").then((m) => m.VaultSettingsComponent);
const loadFoldersComponent = () =>
  import("../vault/popup/settings/folders.component").then((m) => m.FoldersComponent);
const loadBlockedDomainsComponent = () =>
  import("../autofill/popup/settings/blocked-domains.component").then(
    (m) => m.BlockedDomainsComponent,
  );
const loadExcludedDomainsComponent = () =>
  import("../autofill/popup/settings/excluded-domains.component").then(
    (m) => m.ExcludedDomainsComponent,
  );
const loadPremiumV2Component = () =>
  import("../billing/popup/settings/premium-v2.component").then((m) => m.PremiumV2Component);
const loadAppearanceComponent = () =>
  import("../vault/popup/settings/appearance.component").then((m) => m.AppearanceComponent);
const loadAdminSettingsComponent = () =>
  import("../vault/popup/settings/admin-settings.component").then((m) => m.AdminSettingsComponent);
const loadSendAddEditV2Component = () =>
  import("../tools/popup/send-v2/add-edit/send-add-edit.component").then(
    (m) => m.SendAddEditComponent,
  );
const loadSendCreatedComponent = () =>
  import("../tools/popup/send-v2/send-created/send-created.component").then(
    (m) => m.SendCreatedComponent,
  );
const loadAutofillToolsComponent = () =>
  import("../autofill/popup/autofill-tools/autofill-tools.component").then(
    (m) => m.AutofillToolsComponent,
  );
const loadAssignCollections = () =>
  import("../vault/popup/components/vault/assign-collections/assign-collections.component").then(
    (m) => m.AssignCollections,
  );
const loadAboutPageV2Component = () =>
  import("../tools/popup/settings/about-page/about-page-v2.component").then(
    (m) => m.AboutPageV2Component,
  );
const loadMoreFromBitwardenPageComponent = () =>
  import("../vault/popup/settings/more-from-bitwarden-page.component").then(
    (m) => m.MoreFromBitwardenPageComponent,
  );
const loadDownloadBitwardenComponent = () =>
  import("../vault/popup/settings/download-bitwarden.component").then(
    (m) => m.DownloadBitwardenComponent,
  );
const loadDefaultPasswordManagerPromptComponent = () =>
  import("../autofill/popup/default-password-manager/default-password-manager-prompt.component").then(
    (m) => m.DefaultPasswordManagerPromptComponent,
  );
const loadIntroCarouselComponent = () =>
  import("../vault/popup/components/vault/intro-carousel/intro-carousel.component").then(
    (m) => m.IntroCarouselComponent,
  );
const loadTabsV2Component = () => import("./tabs-v2.component").then((m) => m.TabsV2Component);
const loadVaultComponent = () =>
  import("../vault/popup/components/vault/vault.component").then((m) => m.VaultComponent);
const loadSettingsV2Component = () =>
  import("../tools/popup/settings/settings-v2.component").then((m) => m.SettingsV2Component);
const loadSendV2Component = () =>
  import("../tools/popup/send-v2/send-v2.component").then((m) => m.SendV2Component);
const loadAtRiskPasswordsComponent = () =>
  import("../vault/popup/components/at-risk-passwords/at-risk-passwords.component").then(
    (m) => m.AtRiskPasswordsComponent,
  );
const loadAccountSwitcherComponent = () =>
  import("../auth/popup/account-switching/account-switcher.component").then(
    (m) => m.AccountSwitcherComponent,
  );
const loadTrashComponent = () =>
  import("../vault/popup/settings/trash.component").then((m) => m.TrashComponent);
const loadArchiveComponent = () =>
  import("../vault/popup/settings/archive.component").then((m) => m.ArchiveComponent);
const loadPhishingWarningComponent = () =>
  import("../dirt/phishing-detection/popup/phishing-warning.component").then(
    (m) => m.PhishingWarningComponent,
  );
const loadProtectedByComponent = () =>
  import("../dirt/phishing-detection/popup/protected-by-component").then(
    (m) => m.ProtectedByComponent,
  );
const loadAuthenticationTimeoutComponent = () =>
  import("@bitwarden/angular/auth/components/authentication-timeout.component").then(
    (m) => m.AuthenticationTimeoutComponent,
  );
const loadEnvironmentSelectorComponent = () =>
  import("@bitwarden/angular/auth/environment-selector/environment-selector.component").then(
    (m) => m.EnvironmentSelectorComponent,
  );
const loadLoginViaWebAuthnComponent = () =>
  import("@bitwarden/angular/auth/login-via-webauthn/login-via-webauthn.component").then(
    (m) => m.LoginViaWebAuthnComponent,
  );
const loadChangePasswordComponent = () =>
  import("@bitwarden/angular/auth/password-management/change-password").then(
    (m) => m.ChangePasswordComponent,
  );
const loadSetInitialPasswordComponent = () =>
  import("@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.component").then(
    (m) => m.SetInitialPasswordComponent,
  );
const loadLockComponent = () => import("@bitwarden/key-management-ui").then((m) => m.LockComponent);
const loadConfirmKeyConnectorDomainComponent = () =>
  import("@bitwarden/key-management-ui").then((m) => m.ConfirmKeyConnectorDomainComponent);
const loadRemovePasswordComponent = () =>
  import("@bitwarden/key-management-ui").then((m) => m.RemovePasswordComponent);

/**
 * Data properties acceptable for use in extension route objects
 */
export interface RouteDataProperties extends RouteCacheOptions {
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
    loadComponent: loadFido2Component,
    canActivate: [fido2AuthGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "",
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.AuthenticationTimeout,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        children: [
          {
            path: "",
            loadComponent: loadAuthenticationTimeoutComponent,
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
    path: AuthRoute.NewDeviceVerification,
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
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
      showBackButton: true,
      elevation: 1,
    } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
  },
  {
    path: "remove-password",
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        loadComponent: loadRemovePasswordComponent,
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          showBackButton: false,
          pageIcon: LockIcon,
        } satisfies ExtensionAnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "view-cipher",
    loadComponent: loadViewComponent,
    canActivate: [authGuard],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
  },
  {
    path: "cipher-password-history",
    loadComponent: loadPasswordHistoryComponent,
    canActivate: [authGuard],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "new-item",
    loadComponent: loadNewItemPageComponent,
    canActivate: [
      authGuard,
      canAccessFeature(FeatureFlag.PM32009NewItemTypes, true, undefined, false),
    ],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "add-cipher",
    loadComponent: loadAddEditComponent,
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { elevation: 1, resetRouterCacheOnTabChange: true } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "edit-cipher",
    loadComponent: loadAddEditComponent,
    canActivate: [authGuard, debounceNavigationGuard()],
    data: {
      // Above "trash"
      elevation: 3,
      resetRouterCacheOnTabChange: true,
    } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "attachments",
    loadComponent: loadAttachmentsComponent,
    canActivate: [authGuard, filePickerPopoutGuard()],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "generator",
    loadComponent: loadCredentialGeneratorComponent,
    canActivate: [authGuard],
    data: { elevation: 0 } satisfies RouteDataProperties,
  },
  {
    path: "generator-history",
    loadComponent: loadCredentialGeneratorHistoryComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // loadChildren rather than loadComponent so the Keeper provider is declared inside the
    // lazy chunk; see the comment in import.routes.ts.
    path: "import",
    loadChildren: () =>
      import("../tools/popup/settings/import/import.routes").then((m) => m.importRoutes),
  },
  {
    path: "export",
    loadComponent: loadExportBrowserV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "autofill",
    loadComponent: loadAutofillComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.AccountSecurity,
    loadComponent: loadAccountSecurityComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.SettingsPassword,
    loadComponent: loadChangePasswordPageComponent,
    canActivate: [
      // TODO: PM-32419 - remove feature flag check
      canAccessFeature(FeatureFlag.PM32413_MultiClientPasswordManagement),
      authGuard,
      hasPasswordGuard([`/${AuthExtensionRoute.AccountSecurity}`]),
    ],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.DeviceManagement,
    loadComponent: loadExtensionDeviceManagementComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "notifications",
    loadComponent: loadNotificationsSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "vault-settings",
    loadComponent: loadVaultSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "folders",
    loadComponent: loadFoldersComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "blocked-domains",
    loadComponent: loadBlockedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "excluded-domains",
    loadComponent: loadExcludedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "premium",
    loadComponent: loadPremiumV2Component,
    canActivate: [authGuard],
    data: { elevation: 3 } satisfies RouteDataProperties,
  },
  {
    path: "appearance",
    loadComponent: loadAppearanceComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "admin",
    loadComponent: loadAdminSettingsComponent,
    canActivate: [authGuard, canAccessAutoConfirmSettings],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "clone-cipher",
    loadComponent: loadAddEditComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "add-send",
    loadComponent: loadSendAddEditV2Component,
    canActivate: [authGuard, filePickerPopoutGuard()],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "edit-send",
    loadComponent: loadSendAddEditV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "send-created",
    loadComponent: loadSendCreatedComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // Hosts the complementary Triage + Webmapper authoring tools; the `view`
    // query param selects which is shown first.
    path: "autofill-triage",
    loadComponent: loadAutofillToolsComponent,
    canActivate: [authGuard, autofillToolsDevFlagGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "",
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.SignUp,
        canActivate: [unauthGuardFn()],
        data: {
          elevation: 1,
          pageTitle: {
            key: "createAccount",
          },
          showBackButton: true,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
          hideFooter: true,
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
        path: AuthRoute.SetInitialPassword,
        canActivate: [authGuard],
        loadComponent: loadSetInitialPasswordComponent,
        data: {
          elevation: 1,
        } satisfies RouteDataProperties,
      },
      {
        path: AuthRoute.Login,
        canActivate: [
          unauthGuardFn(unauthRouteOverrides),
          DefaultPasswordManagerPromptGuard,
          IntroCarouselGuard,
        ],
        data: {
          pageTitle: {
            key: "loginPageEmailEntryScreenTitle",
          },
          elevation: 1,
          showAcctSwitcher: true,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
          secondaryContentLocation: "footer",
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", component: LoginComponent },
          { path: "", component: LoginSecondaryContentComponent, outlet: "secondary" },
          {
            path: "",
            loadComponent: loadEnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.LoginWithPasskey,
        canActivate: [unauthGuardFn(unauthRouteOverrides), platformPopoutGuard(["linux"])],
        data: {
          pageTitle: {
            key: "logInWithPasskey",
          },
          elevation: 1,
          showBackButton: true,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
          secondaryContentLocation: "footer",
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", loadComponent: loadLoginViaWebAuthnComponent },
          {
            path: "",
            loadComponent: loadEnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.Sso,
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
            loadComponent: loadEnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.LoginWithDevice,
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
            loadComponent: loadEnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.PasswordHint,
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
            loadComponent: loadEnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.AdminApprovalRequested,
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
        path: AuthRoute.LoginInitiated,
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
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
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
            loadComponent: loadLockComponent,
          },
        ],
      },
      {
        path: AuthRoute.TwoFactor,
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
          // `TwoFactorAuthComponent` manually sets its icon based on the 2fa type
          pageIcon: null,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
      },
      {
        path: AuthRoute.ChangePassword,
        data: {
          elevation: 1,
          hideFooter: true,
          pageIcon: LockIcon,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          {
            path: "",
            loadComponent: loadChangePasswordComponent,
          },
        ],
        canActivate: [authGuard],
      },
    ],
  },
  {
    path: "assign-collections",
    loadComponent: loadAssignCollections,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "about",
    loadComponent: loadAboutPageV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "more-from-bitwarden",
    loadComponent: loadMoreFromBitwardenPageComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "download-bitwarden",
    loadComponent: loadDownloadBitwardenComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "default-password-manager-prompt",
    loadComponent: loadDefaultPasswordManagerPromptComponent,
    canActivate: [],
    data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
  },
  {
    path: "intro-carousel",
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
    canActivate: [],
    data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        loadComponent: loadIntroCarouselComponent,
        data: {
          pageIcon: null,
          hideFooter: true,
        } satisfies ExtensionAnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "confirm-key-connector-domain",
    loadComponent: loadExtensionAnonLayoutWrapperComponent,
    canActivate: [],
    data: { elevation: 1 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        loadComponent: loadConfirmKeyConnectorDomainComponent,
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          showBackButton: true,
          pageIcon: DomainIcon,
        } satisfies ExtensionAnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "tabs",
    loadComponent: loadTabsV2Component,
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
        loadComponent: loadVaultComponent,
        canActivate: [authGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "generator",
        loadComponent: loadCredentialGeneratorComponent,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "settings",
        loadComponent: loadSettingsV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "send",
        loadComponent: loadSendV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
    ],
  },
  {
    path: "at-risk-passwords",
    loadComponent: loadAtRiskPasswordsComponent,
    canActivate: [atRiskPasswordAuthGuard, canAccessAtRiskPasswords, hasAtRiskPasswords],
  },
  {
    path: AuthExtensionRoute.AccountSwitcher,
    loadComponent: loadAccountSwitcherComponent,
    data: { elevation: 4, doNotSaveUrl: true } satisfies RouteDataProperties,
  },
  {
    path: "trash",
    loadComponent: loadTrashComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "archive",
    loadComponent: loadArchiveComponent,
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
            loadComponent: loadPhishingWarningComponent,
          },
          {
            path: "",
            loadComponent: loadProtectedByComponent,
            outlet: "secondary",
          },
        ],
        data: {
          pageIcon: null,
          hideBackgroundIllustration: true,
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
