import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import {
  EnvironmentSelectorComponent,
  EnvironmentSelectorRouteData,
  ExtensionDefaultOverlayPosition,
} from "@bitwarden/angular/auth/components/environment-selector.component";
import { TwoFactorTimeoutComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-expired.component";
import { unauthUiRefreshRedirect } from "@bitwarden/angular/auth/functions/unauth-ui-refresh-redirect";
import { unauthUiRefreshSwap } from "@bitwarden/angular/auth/functions/unauth-ui-refresh-route-swap";
import {
  authGuard,
  lockGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { extensionRefreshSwap } from "@bitwarden/angular/utils/extension-refresh-swap";
import { NewDeviceVerificationNoticeGuard } from "@bitwarden/angular/vault/guards";
import {
  AnonLayoutWrapperComponent,
  AnonLayoutWrapperData,
  LoginComponent,
  LoginSecondaryContentComponent,
  LockIcon,
  LockComponent,
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
} from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  NewDeviceVerificationNoticePageOneComponent,
  NewDeviceVerificationNoticePageTwoComponent,
  VaultIcons,
} from "@bitwarden/vault";

import { twofactorRefactorSwap } from "../../../../libs/angular/src/utils/two-factor-component-refactor-route-swap";
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
import { RegisterComponent } from "../auth/popup/register.component";
import { RemovePasswordComponent } from "../auth/popup/remove-password.component";
import { SetPasswordComponent } from "../auth/popup/set-password.component";
import { AccountSecurityComponent as AccountSecurityV1Component } from "../auth/popup/settings/account-security-v1.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { SsoComponentV1 } from "../auth/popup/sso-v1.component";
import { TwoFactorAuthComponent } from "../auth/popup/two-factor-auth.component";
import { TwoFactorOptionsComponent } from "../auth/popup/two-factor-options.component";
import { TwoFactorComponent } from "../auth/popup/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { Fido2Component } from "../autofill/popup/fido2/fido2.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { ExcludedDomainsComponent } from "../autofill/popup/settings/excluded-domains.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PremiumV2Component } from "../billing/popup/settings/premium-v2.component";
import { PremiumComponent } from "../billing/popup/settings/premium.component";
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
import { clearVaultStateGuard } from "../vault/guards/clear-vault-state.guard";
import { AddEditComponent } from "../vault/popup/components/vault/add-edit.component";
import { AttachmentsComponent } from "../vault/popup/components/vault/attachments.component";
import { CollectionsComponent } from "../vault/popup/components/vault/collections.component";
import { PasswordHistoryComponent } from "../vault/popup/components/vault/password-history.component";
import { ShareComponent } from "../vault/popup/components/vault/share.component";
import { VaultItemsComponent } from "../vault/popup/components/vault/vault-items.component";
import { VaultV2Component } from "../vault/popup/components/vault/vault-v2.component";
import { ViewComponent } from "../vault/popup/components/vault/view.component";
import { AddEditV2Component } from "../vault/popup/components/vault-v2/add-edit/add-edit-v2.component";
import { AssignCollections } from "../vault/popup/components/vault-v2/assign-collections/assign-collections.component";
import { AttachmentsV2Component } from "../vault/popup/components/vault-v2/attachments/attachments-v2.component";
import { PasswordHistoryV2Component } from "../vault/popup/components/vault-v2/vault-password-history-v2/vault-password-history-v2.component";
import { ViewV2Component } from "../vault/popup/components/vault-v2/view-v2/view-v2.component";
import { AppearanceV2Component } from "../vault/popup/settings/appearance-v2.component";
import { AppearanceComponent } from "../vault/popup/settings/appearance.component";
import { FolderAddEditComponent } from "../vault/popup/settings/folder-add-edit.component";
import { FoldersV2Component } from "../vault/popup/settings/folders-v2.component";
import { FoldersComponent } from "../vault/popup/settings/folders.component";
import { SyncComponent } from "../vault/popup/settings/sync.component";
import { TrashComponent } from "../vault/popup/settings/trash.component";
import { VaultSettingsV2Component } from "../vault/popup/settings/vault-settings-v2.component";
import { VaultSettingsComponent } from "../vault/popup/settings/vault-settings.component";

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
  ...twofactorRefactorSwap(
    TwoFactorComponent,
    AnonLayoutWrapperComponent,
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { elevation: 1 } satisfies RouteDataProperties,
    },
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { elevation: 1 } satisfies RouteDataProperties,
      children: [
        {
          path: "",
          component: TwoFactorAuthComponent,
        },
      ],
    },
  ),
  {
    path: "",
    component: ExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: "2fa-timeout",
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        children: [
          {
            path: "",
            component: TwoFactorTimeoutComponent,
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
    component: TwoFactorOptionsComponent,
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
    path: "register",
    component: RegisterComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "environment",
    component: EnvironmentComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "ciphers",
    component: VaultItemsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...extensionRefreshSwap(ViewComponent, ViewV2Component, {
    path: "view-cipher",
    canActivate: [authGuard],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
  }),
  ...extensionRefreshSwap(PasswordHistoryComponent, PasswordHistoryV2Component, {
    path: "cipher-password-history",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "add-cipher",
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { elevation: 1 } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  }),
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "edit-cipher",
    canActivate: [authGuard, debounceNavigationGuard()],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  }),
  {
    path: "share-cipher",
    component: ShareComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "collections",
    component: CollectionsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...extensionRefreshSwap(AttachmentsComponent, AttachmentsV2Component, {
    path: "attachments",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
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
  ...extensionRefreshSwap(AccountSecurityV1Component, AccountSecurityComponent, {
    path: "account-security",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
  {
    path: "notifications",
    component: NotificationsSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  ...extensionRefreshSwap(VaultSettingsComponent, VaultSettingsV2Component, {
    path: "vault-settings",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
  ...extensionRefreshSwap(FoldersComponent, FoldersV2Component, {
    path: "folders",
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  }),
  {
    path: "add-folder",
    component: FolderAddEditComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "edit-folder",
    component: FolderAddEditComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "sync",
    component: SyncComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "excluded-domains",
    component: ExcludedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  ...extensionRefreshSwap(PremiumComponent, PremiumV2Component, {
    path: "premium",
    component: PremiumComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
  ...extensionRefreshSwap(AppearanceComponent, AppearanceV2Component, {
    path: "appearance",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "clone-cipher",
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  }),
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
          key: "loginInitiated",
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
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification), unauthGuardFn()],
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
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification), unauthGuardFn()],
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
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification)],
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
    canActivate: [canAccessFeature(FeatureFlag.ExtensionRefresh, true, "/")],
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
