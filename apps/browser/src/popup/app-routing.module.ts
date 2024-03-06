import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import {
  redirectGuard,
  AuthGuard,
  lockGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@bitwarden/angular/auth/guards";

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
import { SsoComponent } from "../auth/popup/sso.component";
import { TwoFactorOptionsComponent } from "../auth/popup/two-factor-options.component";
import { TwoFactorComponent } from "../auth/popup/two-factor.component";
import { UpdateTempPasswordComponent } from "../auth/popup/update-temp-password.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import BrowserPopupUtils from "../platform/popup/browser-popup-utils";
import { GeneratorComponent } from "../tools/popup/generator/generator.component";
import { PasswordGeneratorHistoryComponent } from "../tools/popup/generator/password-generator-history.component";
import { SendAddEditComponent } from "../tools/popup/send/send-add-edit.component";
import { SendGroupingsComponent } from "../tools/popup/send/send-groupings.component";
import { SendTypeComponent } from "../tools/popup/send/send-type.component";
import { ExportComponent } from "../tools/popup/settings/export.component";
import { ImportBrowserComponent } from "../tools/popup/settings/import/import-browser.component";
import { Fido2Component } from "../vault/popup/components/fido2/fido2.component";
import { AddEditComponent } from "../vault/popup/components/vault/add-edit.component";
import { AttachmentsComponent } from "../vault/popup/components/vault/attachments.component";
import { CollectionsComponent } from "../vault/popup/components/vault/collections.component";
import { CurrentTabComponent } from "../vault/popup/components/vault/current-tab.component";
import { PasswordHistoryComponent } from "../vault/popup/components/vault/password-history.component";
import { ShareComponent } from "../vault/popup/components/vault/share.component";
import { VaultFilterComponent } from "../vault/popup/components/vault/vault-filter.component";
import { VaultItemsComponent } from "../vault/popup/components/vault/vault-items.component";
import { ViewComponent } from "../vault/popup/components/vault/view.component";
import { FolderAddEditComponent } from "../vault/popup/settings/folder-add-edit.component";

import { resumePopupGuard } from "./resume-popup.guard";
import { debounceNavigationGuard } from "./services/debounce-navigation.service";
import { ExcludedDomainsComponent } from "./settings/excluded-domains.component";
import { FoldersComponent } from "./settings/folders.component";
import { HelpAndFeedbackComponent } from "./settings/help-and-feedback.component";
import { OptionsComponent } from "./settings/options.component";
import { PremiumComponent } from "./settings/premium.component";
import { SettingsComponent } from "./settings/settings.component";
import { SyncComponent } from "./settings/sync.component";
import { TabsComponent } from "./tabs.component";

const unauthRouteOverrides = {
  homepage: () => {
    return BrowserPopupUtils.inPopout(window) ? "/tabs/vault" : "/tabs/current";
  },
};

const routes: Routes = [
  {
    path: "",
    canActivateChild: [resumePopupGuard],
    children: [
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
      {
        path: "2fa",
        component: TwoFactorComponent,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: { state: "2fa" },
      },
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
        canActivate: [AuthGuard],
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
        canActivate: [AuthGuard],
        data: { state: "ciphers" },
      },
      {
        path: "view-cipher",
        component: ViewComponent,
        canActivate: [AuthGuard],
        data: { state: "view-cipher" },
      },
      {
        path: "cipher-password-history",
        component: PasswordHistoryComponent,
        canActivate: [AuthGuard],
        data: { state: "cipher-password-history" },
      },
      {
        path: "add-cipher",
        component: AddEditComponent,
        canActivate: [AuthGuard, debounceNavigationGuard()],
        data: { state: "add-cipher" },
        runGuardsAndResolvers: "always",
      },
      {
        path: "edit-cipher",
        component: AddEditComponent,
        canActivate: [AuthGuard, debounceNavigationGuard()],
        data: { state: "edit-cipher" },
        runGuardsAndResolvers: "always",
      },
      {
        path: "share-cipher",
        component: ShareComponent,
        canActivate: [AuthGuard],
        data: { state: "share-cipher" },
      },
      {
        path: "collections",
        component: CollectionsComponent,
        canActivate: [AuthGuard],
        data: { state: "collections" },
      },
      {
        path: "attachments",
        component: AttachmentsComponent,
        canActivate: [AuthGuard],
        data: { state: "attachments" },
      },
      {
        path: "generator",
        component: GeneratorComponent,
        canActivate: [AuthGuard],
        data: { state: "generator" },
      },
      {
        path: "generator-history",
        component: PasswordGeneratorHistoryComponent,
        canActivate: [AuthGuard],
        data: { state: "generator-history" },
      },
      {
        path: "import",
        component: ImportBrowserComponent,
        canActivate: [AuthGuard],
        data: { state: "import" },
      },
      {
        path: "export",
        component: ExportComponent,
        canActivate: [AuthGuard],
        data: { state: "export" },
      },
      {
        path: "autofill",
        component: AutofillComponent,
        canActivate: [AuthGuard],
        data: { state: "autofill" },
      },
      {
        path: "folders",
        component: FoldersComponent,
        canActivate: [AuthGuard],
        data: { state: "folders" },
      },
      {
        path: "add-folder",
        component: FolderAddEditComponent,
        canActivate: [AuthGuard],
        data: { state: "add-folder" },
      },
      {
        path: "edit-folder",
        component: FolderAddEditComponent,
        canActivate: [AuthGuard],
        data: { state: "edit-folder" },
      },
      {
        path: "sync",
        component: SyncComponent,
        canActivate: [AuthGuard],
        data: { state: "sync" },
      },
      {
        path: "excluded-domains",
        component: ExcludedDomainsComponent,
        canActivate: [AuthGuard],
        data: { state: "excluded-domains" },
      },
      {
        path: "premium",
        component: PremiumComponent,
        canActivate: [AuthGuard],
        data: { state: "premium" },
      },
      {
        path: "options",
        component: OptionsComponent,
        canActivate: [AuthGuard],
        data: { state: "options" },
      },
      {
        path: "clone-cipher",
        component: AddEditComponent,
        canActivate: [AuthGuard],
        data: { state: "clone-cipher" },
      },
      {
        path: "send-type",
        component: SendTypeComponent,
        canActivate: [AuthGuard],
        data: { state: "send-type" },
      },
      {
        path: "add-send",
        component: SendAddEditComponent,
        canActivate: [AuthGuard],
        data: { state: "add-send" },
      },
      {
        path: "edit-send",
        component: SendAddEditComponent,
        canActivate: [AuthGuard],
        data: { state: "edit-send" },
      },
      {
        path: "update-temp-password",
        component: UpdateTempPasswordComponent,
        canActivate: [AuthGuard],
        data: { state: "update-temp-password" },
      },
      {
        path: "help-and-feedback",
        component: HelpAndFeedbackComponent,
        canActivate: [AuthGuard],
        data: { state: "help-and-feedback" },
      },
      {
        path: "tabs",
        component: TabsComponent,
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
            canActivate: [AuthGuard],
            data: { state: "tabs_current" },
            runGuardsAndResolvers: "always",
          },
          {
            path: "vault",
            component: VaultFilterComponent,
            canActivate: [AuthGuard],
            data: { state: "tabs_vault" },
          },
          {
            path: "generator",
            component: GeneratorComponent,
            canActivate: [AuthGuard],
            data: { state: "tabs_generator" },
          },
          {
            path: "settings",
            component: SettingsComponent,
            canActivate: [AuthGuard],
            data: { state: "tabs_settings" },
          },
          {
            path: "send",
            component: SendGroupingsComponent,
            canActivate: [AuthGuard],
            data: { state: "tabs_send" },
          },
        ],
      },
      {
        path: "account-switcher",
        component: AccountSwitcherComponent,
        data: { state: "account-switcher", doNotSaveUrl: true },
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
