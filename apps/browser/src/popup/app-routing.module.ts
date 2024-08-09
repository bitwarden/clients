import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import {
  authGuard,
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
  SetPasswordJitComponent,
} from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { twofactorRefactorSwap } from "../../../../libs/angular/src/utils/two-factor-component-refactor-route-swap";
import { fido2AuthGuard } from "../auth/guards/fido2-auth.guard";
import { AccountSwitcherComponent } from "../auth/popup/account-switching/account-switcher.component";
import { EnvironmentComponent } from "../auth/popup/environment.component";
import { HintComponent } from "../auth/popup/hint.component";
import { HomeComponent } from "../auth/popup/home.component";
import { LockComponent } from "../auth/popup/lock.component";
import { LoginDecryptionOptionsComponent } from "../auth/popup/login-decryption-options/login-decryption-options.component";
import { LoginViaAuthRequestComponent } from "../auth/popup/login-via-auth-request.component";
import { LoginComponent } from "../auth/popup/login.component";
import { RegisterComponent } from "../auth/popup/register.component";
import { RemovePasswordComponent } from "../auth/popup/remove-password.component";
import { SetPasswordComponent } from "../auth/popup/set-password.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { SsoComponent } from "../auth/popup/sso.component";
import { TwoFactorAuthComponent } from "../auth/popup/two-factor-auth.component";
import { TwoFactorOptionsComponent } from "../auth/popup/two-factor-options.component";
import { TwoFactorComponent } from "../auth/popup/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { Fido2Component } from "../autofill/popup/fido2/fido2.component";
import { AutofillV1Component } from "../autofill/popup/settings/autofill-v1.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { ExcludedDomainsV1Component } from "../autofill/popup/settings/excluded-domains-v1.component";
import { ExcludedDomainsComponent } from "../autofill/popup/settings/excluded-domains.component";
import { NotificationsSettingsV1Component } from "../autofill/popup/settings/notifications-v1.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PremiumComponent } from "../billing/popup/settings/premium.component";
import BrowserPopupUtils from "../platform/popup/browser-popup-utils";
import { GeneratorComponent } from "../tools/popup/generator/generator.component";
import { PasswordGeneratorHistoryComponent } from "../tools/popup/generator/password-generator-history.component";
import { SendAddEditComponent } from "../tools/popup/send/send-add-edit.component";
import { SendGroupingsComponent } from "../tools/popup/send/send-groupings.component";
import { SendTypeComponent } from "../tools/popup/send/send-type.component";
import { SendV2Component } from "../tools/popup/send-v2/send-v2.component";
import { AboutPageV2Component } from "../tools/popup/settings/about-page/about-page-v2.component";
import { AboutPageComponent } from "../tools/popup/settings/about-page/about-page.component";
import { MoreFromBitwardenPageV2Component } from "../tools/popup/settings/about-page/more-from-bitwarden-page-v2.component";
import { MoreFromBitwardenPageComponent } from "../tools/popup/settings/about-page/more-from-bitwarden-page.component";
import { ExportBrowserV2Component } from "../tools/popup/settings/export/export-browser-v2.component";
import { ExportBrowserComponent } from "../tools/popup/settings/export/export-browser.component";
import { ImportBrowserV2Component } from "../tools/popup/settings/import/import-browser-v2.component";
import { ImportBrowserComponent } from "../tools/popup/settings/import/import-browser.component";
import { SettingsV2Component } from "../tools/popup/settings/settings-v2.component";
import { SettingsComponent } from "../tools/popup/settings/settings.component";
import { clearVaultStateGuard } from "../vault/guards/clear-vault-state.guard";
import { AddEditComponent } from "../vault/popup/components/vault/add-edit.component";
import { AttachmentsComponent } from "../vault/popup/components/vault/attachments.component";
import { CollectionsComponent } from "../vault/popup/components/vault/collections.component";
import { CurrentTabComponent } from "../vault/popup/components/vault/current-tab.component";
import { PasswordHistoryComponent } from "../vault/popup/components/vault/password-history.component";
import { ShareComponent } from "../vault/popup/components/vault/share.component";
import { VaultFilterComponent } from "../vault/popup/components/vault/vault-filter.component";
import { VaultItemsComponent } from "../vault/popup/components/vault/vault-items.component";
import { VaultV2Component } from "../vault/popup/components/vault/vault-v2.component";
import { ViewComponent } from "../vault/popup/components/vault/view.component";
import { AddEditV2Component } from "../vault/popup/components/vault-v2/add-edit/add-edit-v2.component";
import { AssignCollections } from "../vault/popup/components/vault-v2/assign-collections/assign-collections.component";
import { AttachmentsV2Component } from "../vault/popup/components/vault-v2/attachments/attachments-v2.component";
import { ViewV2Component } from "../vault/popup/components/vault-v2/view-v2/view-v2.component";
import { AppearanceV2Component } from "../vault/popup/settings/appearance-v2.component";
import { AppearanceComponent } from "../vault/popup/settings/appearance.component";
import { FolderAddEditComponent } from "../vault/popup/settings/folder-add-edit.component";
import { FoldersV2Component } from "../vault/popup/settings/folders-v2.component";
import { FoldersComponent } from "../vault/popup/settings/folders.component";
import { SyncComponent } from "../vault/popup/settings/sync.component";
import { VaultSettingsV2Component } from "../vault/popup/settings/vault-settings-v2.component";
import { VaultSettingsComponent } from "../vault/popup/settings/vault-settings.component";

import { extensionRefreshRedirect, extensionRefreshSwap } from "./extension-refresh-route-utils";
import { debounceNavigationGuard } from "./services/debounce-navigation.service";
import { TabsV2Component } from "./tabs-v2.component";
import { TabsComponent } from "./tabs.component";

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
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "home" },
  },
  {
    path: "fido2",
    component: Fido2Component,
    canActivate: [fido2AuthGuard],
    data: { state: "fido2" },
  },
  {
    path: "login",
    component: LoginComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "login" },
  },
  {
    path: "login-with-device",
    component: LoginViaAuthRequestComponent,
    canActivate: [],
    data: { state: "login-with-device" },
  },
  {
    path: "admin-approval-requested",
    component: LoginViaAuthRequestComponent,
    canActivate: [],
    data: { state: "login-with-device" },
  },
  {
    path: "lock",
    component: LockComponent,
    canActivate: [lockGuard()],
    data: { state: "lock", doNotSaveUrl: true },
  },
  ...twofactorRefactorSwap(
    TwoFactorComponent,
    AnonLayoutWrapperComponent,
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { state: "2fa" },
    },
    {
      path: "2fa",
      canActivate: [unauthGuardFn(unauthRouteOverrides)],
      data: { state: "2fa" },
      children: [
        {
          path: "",
          component: TwoFactorAuthComponent,
        },
      ],
    },
  ),
  {
    path: "2fa-options",
    component: TwoFactorOptionsComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "2fa-options" },
  },
  {
    path: "login-initiated",
    component: LoginDecryptionOptionsComponent,
    canActivate: [tdeDecryptionRequiredGuard()],
  },
  {
    path: "sso",
    component: SsoComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "sso" },
  },
  {
    path: "set-password",
    component: SetPasswordComponent,
    data: { state: "set-password" },
  },
  {
    path: "remove-password",
    component: RemovePasswordComponent,
    canActivate: [authGuard],
    data: { state: "remove-password" },
  },
  {
    path: "register",
    component: RegisterComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "register" },
  },
  {
    path: "hint",
    component: HintComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "hint" },
  },
  {
    path: "environment",
    component: EnvironmentComponent,
    canActivate: [unauthGuardFn(unauthRouteOverrides)],
    data: { state: "environment" },
  },
  {
    path: "ciphers",
    component: VaultItemsComponent,
    canActivate: [authGuard],
    data: { state: "ciphers" },
  },
  ...extensionRefreshSwap(ViewComponent, ViewV2Component, {
    path: "view-cipher",
    canActivate: [authGuard],
    data: { state: "view-cipher" },
  }),
  {
    path: "cipher-password-history",
    component: PasswordHistoryComponent,
    canActivate: [authGuard],
    data: { state: "cipher-password-history" },
  },
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "add-cipher",
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { state: "add-cipher" },
    runGuardsAndResolvers: "always",
  }),
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "edit-cipher",
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { state: "edit-cipher" },
    runGuardsAndResolvers: "always",
  }),
  {
    path: "share-cipher",
    component: ShareComponent,
    canActivate: [authGuard],
    data: { state: "share-cipher" },
  },
  {
    path: "collections",
    component: CollectionsComponent,
    canActivate: [authGuard],
    data: { state: "collections" },
  },
  ...extensionRefreshSwap(AttachmentsComponent, AttachmentsV2Component, {
    path: "attachments",
    canActivate: [authGuard],
    data: { state: "attachments" },
  }),
  {
    path: "generator",
    component: GeneratorComponent,
    canActivate: [authGuard],
    data: { state: "generator" },
  },
  {
    path: "generator-history",
    component: PasswordGeneratorHistoryComponent,
    canActivate: [authGuard],
    data: { state: "generator-history" },
  },
  ...extensionRefreshSwap(ImportBrowserComponent, ImportBrowserV2Component, {
    path: "import",
    canActivate: [authGuard],
    data: { state: "import" },
  }),
  ...extensionRefreshSwap(ExportBrowserComponent, ExportBrowserV2Component, {
    path: "export",
    canActivate: [authGuard],
    data: { state: "export" },
  }),
  ...extensionRefreshSwap(AutofillV1Component, AutofillComponent, {
    path: "autofill",
    canActivate: [authGuard],
    data: { state: "autofill" },
  }),
  {
    path: "account-security",
    component: AccountSecurityComponent,
    canActivate: [authGuard],
    data: { state: "account-security" },
  },
  ...extensionRefreshSwap(NotificationsSettingsV1Component, NotificationsSettingsComponent, {
    path: "notifications",
    component: NotificationsSettingsV1Component,
    canActivate: [authGuard],
    data: { state: "notifications" },
  }),
  ...extensionRefreshSwap(VaultSettingsComponent, VaultSettingsV2Component, {
    path: "vault-settings",
    canActivate: [authGuard],
    data: { state: "vault-settings" },
  }),
  ...extensionRefreshSwap(FoldersComponent, FoldersV2Component, {
    path: "folders",
    canActivate: [authGuard],
    data: { state: "folders" },
  }),
  {
    path: "add-folder",
    component: FolderAddEditComponent,
    canActivate: [authGuard],
    data: { state: "add-folder" },
  },
  {
    path: "edit-folder",
    component: FolderAddEditComponent,
    canActivate: [authGuard],
    data: { state: "edit-folder" },
  },
  {
    path: "sync",
    component: SyncComponent,
    canActivate: [authGuard],
    data: { state: "sync" },
  },
  ...extensionRefreshSwap(ExcludedDomainsV1Component, ExcludedDomainsComponent, {
    path: "excluded-domains",
    component: ExcludedDomainsV1Component,
    canActivate: [authGuard],
    data: { state: "excluded-domains" },
  }),
  {
    path: "premium",
    component: PremiumComponent,
    canActivate: [authGuard],
    data: { state: "premium" },
  },
  ...extensionRefreshSwap(AppearanceComponent, AppearanceV2Component, {
    path: "appearance",
    canActivate: [authGuard],
    data: { state: "appearance" },
  }),
  ...extensionRefreshSwap(AddEditComponent, AddEditV2Component, {
    path: "clone-cipher",
    canActivate: [authGuard],
    data: { state: "clone-cipher" },
  }),
  {
    path: "send-type",
    component: SendTypeComponent,
    canActivate: [authGuard],
    data: { state: "send-type" },
  },
  {
    path: "add-send",
    component: SendAddEditComponent,
    canActivate: [authGuard],
    data: { state: "add-send" },
  },
  {
    path: "edit-send",
    component: SendAddEditComponent,
    canActivate: [authGuard],
    data: { state: "edit-send" },
  },
  {
    path: "update-temp-password",
    component: UpdateTempPasswordComponent,
    canActivate: [authGuard],
    data: { state: "update-temp-password" },
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
              loginRoute: "/home",
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
      {
        path: "set-password-jit",
        canActivate: [canAccessFeature(FeatureFlag.EmailVerification)],
        component: SetPasswordJitComponent,
        data: {
          pageTitle: "joinOrganization",
          pageSubtitle: "finishJoiningThisOrganizationBySettingAMasterPassword",
        } satisfies AnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "assign-collections",
    component: AssignCollections,
    canActivate: [canAccessFeature(FeatureFlag.ExtensionRefresh, true, "/")],
    data: { state: "assign-collections" },
  },
  ...extensionRefreshSwap(AboutPageComponent, AboutPageV2Component, {
    path: "about",
    canActivate: [authGuard],
    data: { state: "about" },
  }),
  ...extensionRefreshSwap(MoreFromBitwardenPageComponent, MoreFromBitwardenPageV2Component, {
    path: "more-from-bitwarden",
    canActivate: [authGuard],
    data: { state: "moreFromBitwarden" },
  }),
  ...extensionRefreshSwap(TabsComponent, TabsV2Component, {
    path: "tabs",
    data: { state: "tabs" },
    children: [
      {
        path: "",
        redirectTo: "/tabs/vault",
        pathMatch: "full",
      },
      {
        path: "current",
        component: CurrentTabComponent,
        canActivate: [authGuard],
        canMatch: [extensionRefreshRedirect("/tabs/vault")],
        data: { state: "tabs_current" },
        runGuardsAndResolvers: "always",
      },
      ...extensionRefreshSwap(VaultFilterComponent, VaultV2Component, {
        path: "vault",
        canActivate: [authGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { state: "tabs_vault" },
      }),
      {
        path: "generator",
        component: GeneratorComponent,
        canActivate: [authGuard],
        data: { state: "tabs_generator" },
      },
      ...extensionRefreshSwap(SettingsComponent, SettingsV2Component, {
        path: "settings",
        canActivate: [authGuard],
        data: { state: "tabs_settings" },
      }),
      ...extensionRefreshSwap(SendGroupingsComponent, SendV2Component, {
        path: "send",
        canActivate: [authGuard],
        data: { state: "tabs_send" },
      }),
    ],
  }),
  {
    path: "account-switcher",
    component: AccountSwitcherComponent,
    data: { state: "account-switcher", doNotSaveUrl: true },
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
