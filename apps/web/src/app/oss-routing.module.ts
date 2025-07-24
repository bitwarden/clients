import { NgModule } from "@angular/core";
import { Route, RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@bitwarden/angular/auth/components/authentication-timeout.component";
import {
  authGuard,
  lockGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
  activeAuthGuard,
} from "@bitwarden/angular/auth/guards";
import { ChangePasswordComponent } from "@bitwarden/angular/auth/password-management/change-password";
import { SetInitialPasswordComponent } from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.component";
import {
  PasswordHintComponent,
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
  RegistrationLinkExpiredComponent,
  LoginComponent,
  LoginSecondaryContentComponent,
  TwoFactorTimeoutIcon,
  UserLockIcon,
  SsoKeyIcon,
  LoginViaAuthRequestComponent,
  DevicesIcon,
  RegistrationUserAddIcon,
  RegistrationLockAltIcon,
  RegistrationExpiredLinkIcon,
  SsoComponent,
  VaultIcon,
  LoginDecryptionOptionsComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
  DeviceVerificationIcon,
} from "@bitwarden/auth/angular";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData, Icons } from "@bitwarden/components";
import { LockComponent } from "@bitwarden/key-management-ui";
import { VaultIcons } from "@bitwarden/vault";

import { flagEnabled, Flags } from "../utils/flags";

import { VerifyRecoverDeleteOrgComponent } from "./admin-console/organizations/manage/verify-recover-delete-org.component";
import { AcceptFamilySponsorshipComponent } from "./admin-console/organizations/sponsorships/accept-family-sponsorship.component";
import { FamiliesForEnterpriseSetupComponent } from "./admin-console/organizations/sponsorships/families-for-enterprise-setup.component";
import { CreateOrganizationComponent } from "./admin-console/settings/create-organization.component";
import { deepLinkGuard } from "./auth/guards/deep-link/deep-link.guard";
import { LoginViaWebAuthnComponent } from "./auth/login/login-via-webauthn/login-via-webauthn.component";
import { AcceptOrganizationComponent } from "./auth/organization-invite/accept-organization.component";
import { RecoverDeleteComponent } from "./auth/recover-delete.component";
import { RecoverTwoFactorComponent } from "./auth/recover-two-factor.component";
import { AccountComponent } from "./auth/settings/account/account.component";
import { EmergencyAccessComponent } from "./auth/settings/emergency-access/emergency-access.component";
import { EmergencyAccessViewComponent } from "./auth/settings/emergency-access/view/emergency-access-view.component";
import { SecurityRoutingModule } from "./auth/settings/security/security-routing.module";
import { VerifyEmailTokenComponent } from "./auth/verify-email-token.component";
import { VerifyRecoverDeleteComponent } from "./auth/verify-recover-delete.component";
import { SponsoredFamiliesComponent } from "./billing/settings/sponsored-families.component";
import { CompleteTrialInitiationComponent } from "./billing/trial-initiation/complete-trial-initiation/complete-trial-initiation.component";
import { freeTrialTextResolver } from "./billing/trial-initiation/complete-trial-initiation/resolver/free-trial-text.resolver";
import { EnvironmentSelectorComponent } from "./components/environment-selector/environment-selector.component";
import { RouteDataProperties } from "./core";
import { ReportsModule } from "./dirt/reports";
import { RemovePasswordComponent } from "./key-management/key-connector/remove-password.component";
import { FrontendLayoutComponent } from "./layouts/frontend-layout.component";
import { UserLayoutComponent } from "./layouts/user-layout.component";
import { RequestSMAccessComponent } from "./secrets-manager/secrets-manager-landing/request-sm-access.component";
import { SMLandingComponent } from "./secrets-manager/secrets-manager-landing/sm-landing.component";
import { DomainRulesComponent } from "./settings/domain-rules.component";
import { PreferencesComponent } from "./settings/preferences.component";
import { CredentialGeneratorComponent } from "./tools/credential-generator/credential-generator.component";
import { AccessComponent, SendAccessExplainerComponent } from "./tools/send/send-access";
import { SendComponent } from "./tools/send/send.component";
import { BrowserExtensionPromptInstallComponent } from "./vault/components/browser-extension-prompt/browser-extension-prompt-install.component";
import { BrowserExtensionPromptComponent } from "./vault/components/browser-extension-prompt/browser-extension-prompt.component";
import { SetupExtensionComponent } from "./vault/components/setup-extension/setup-extension.component";
import { setupExtensionRedirectGuard } from "./vault/guards/setup-extension-redirect.guard";
import { VaultModule } from "./vault/individual-vault/vault.module";

const routes: Routes = [
  // These need to be placed at the top of the list prior to the root
  // so that the redirectGuard does not interrupt the navigation.
  {
    path: "register",
    redirectTo: "signup",
    pathMatch: "full",
  },
  {
    path: "trial",
    redirectTo: "signup",
    pathMatch: "full",
  },
  {
    path: "",
    component: FrontendLayoutComponent,
    data: { doNotSaveUrl: true } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        pathMatch: "full",
        children: [], // Children lets us have an empty component.
        canActivate: [redirectGuard()], // Redirects either to vault, login, or lock page.
      },
      {
        path: "login-with-passkey",
        component: LoginViaWebAuthnComponent,
        data: { titleId: "logInWithPasskey" } satisfies RouteDataProperties,
      },
      { path: "verify-email", component: VerifyEmailTokenComponent },
      {
        path: "accept-organization",
        canActivate: [deepLinkGuard()],
        component: AcceptOrganizationComponent,
        data: { titleId: "joinOrganization", doNotSaveUrl: false } satisfies RouteDataProperties,
      },
      {
        path: "accept-families-for-enterprise",
        component: AcceptFamilySponsorshipComponent,
        canActivate: [deepLinkGuard()],
        data: {
          titleId: "acceptFamilySponsorship",
          doNotSaveUrl: false,
        } satisfies RouteDataProperties,
      },
      { path: "recover", pathMatch: "full", redirectTo: "recover-2fa" },
      {
        path: "verify-recover-delete-org",
        component: VerifyRecoverDeleteOrgComponent,
        canActivate: [unauthGuardFn()],
        data: { titleId: "deleteOrganization" },
      },
    ],
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
          titleId: "createAccount",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
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
          titleId: "setAStrongPassword",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
        ],
      },
      {
        path: "login",
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "logInToBitwarden",
          },
          pageIcon: VaultIcon,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: LoginComponent,
          },
          {
            path: "",
            component: LoginSecondaryContentComponent,
            outlet: "secondary",
          },
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
          titleId: "loginInitiated",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
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
          titleId: "adminApprovalRequested",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
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
          state: "hint",
        },
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
        path: "login-initiated",
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
        },
        children: [{ path: "", component: LoginDecryptionOptionsComponent }],
      },
      {
        path: "send/:sendId/:key",
        data: {
          pageTitle: {
            key: "viewSend",
          },
          showReadonlyHostname: true,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: AccessComponent,
          },
          {
            path: "",
            outlet: "secondary",
            component: SendAccessExplainerComponent,
          },
        ],
      },
      {
        path: "set-initial-password",
        canActivate: [authGuard],
        component: SetInitialPasswordComponent,
        data: {
          maxWidth: "lg",
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: "signup-link-expired",
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: RegistrationExpiredLinkIcon,
          pageTitle: {
            key: "expiredLink",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationLinkExpiredComponent,
            data: {
              loginRoute: "/login",
            } satisfies RegistrationStartSecondaryComponentData,
          },
        ],
      },
      {
        path: "sso",
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "singleSignOn",
          },
          titleId: "enterpriseSingleSignOn",
          pageSubtitle: {
            key: "singleSignOnEnterOrgIdentifierText",
          },
          pageIcon: SsoKeyIcon,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: SsoComponent,
          },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "2fa",
        component: TwoFactorAuthComponent,
        canActivate: [unauthGuardFn(), TwoFactorAuthGuard],
        children: [
          {
            path: "",
            component: TwoFactorAuthComponent,
          },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
        data: {
          pageTitle: {
            key: "verifyYourIdentity",
          },
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: "lock",
        canActivate: [deepLinkGuard(), lockGuard()],
        children: [
          {
            path: "",
            component: LockComponent,
          },
        ],
        data: {
          pageTitle: {
            key: "yourVaultIsLockedV2",
          },
          pageIcon: Icons.LockIcon,
          showReadonlyHostname: true,
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: "authentication-timeout",
        canActivate: [unauthGuardFn()],
        children: [
          {
            path: "",
            component: AuthenticationTimeoutComponent,
          },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
        data: {
          pageIcon: TwoFactorTimeoutIcon,
          pageTitle: {
            key: "authenticationTimeout",
          },
          titleId: "authenticationTimeout",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: "recover-2fa",
        canActivate: [unauthGuardFn()],
        children: [
          {
            path: "",
            component: RecoverTwoFactorComponent,
          },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
        data: {
          pageTitle: {
            key: "recoverAccountTwoStep",
          },
          titleId: "recoverAccountTwoStep",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: "device-verification",
        canActivate: [unauthGuardFn(), activeAuthGuard()],
        children: [
          {
            path: "",
            component: NewDeviceVerificationComponent,
          },
        ],
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
        path: "accept-emergency",
        canActivate: [deepLinkGuard()],
        data: {
          pageTitle: {
            key: "emergencyAccess",
          },
          titleId: "acceptEmergency",
          doNotSaveUrl: false,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            loadComponent: () =>
              import("./auth/emergency-access/accept/accept-emergency.component").then(
                (mod) => mod.AcceptEmergencyComponent,
              ),
          },
        ],
      },
      {
        path: "recover-delete",
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "deleteAccount",
          },
          titleId: "deleteAccount",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RecoverDeleteComponent,
          },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: "verify-recover-delete",
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "deleteAccount",
          },
          titleId: "deleteAccount",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: VerifyRecoverDeleteComponent,
          },
        ],
      },
      {
        path: "remove-password",
        component: RemovePasswordComponent,
        canActivate: [authGuard],
        data: {
          pageTitle: {
            key: "removeMasterPassword",
          },
          titleId: "removeMasterPassword",
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: "trial-initiation",
        canActivate: [unauthGuardFn()],
        component: CompleteTrialInitiationComponent,
        resolve: {
          pageTitle: freeTrialTextResolver,
        },
        data: {
          maxWidth: "3xl",
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: "secrets-manager-trial-initiation",
        canActivate: [unauthGuardFn()],
        component: CompleteTrialInitiationComponent,
        resolve: {
          pageTitle: freeTrialTextResolver,
        },
        data: {
          maxWidth: "3xl",
        } satisfies AnonLayoutWrapperData,
      },
      {
        path: "browser-extension-prompt",
        data: {
          pageIcon: VaultIcons.BrowserExtensionIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: BrowserExtensionPromptComponent,
          },
          {
            path: "",
            component: BrowserExtensionPromptInstallComponent,
            outlet: "secondary",
          },
        ],
      },
      {
        path: "change-password",
        component: ChangePasswordComponent,
        canActivate: [authGuard],
      },
      {
        path: "setup-extension",
        data: {
          hideCardWrapper: true,
          hideIcon: true,
          maxWidth: "4xl",
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: SetupExtensionComponent,
          },
        ],
      },
    ],
  },
  {
    path: "",
    component: UserLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard],
    children: [
      {
        path: "vault",
        canActivate: [setupExtensionRedirectGuard],
        loadChildren: () => VaultModule,
      },
      {
        path: "sends",
        component: SendComponent,
        data: { titleId: "send" } satisfies RouteDataProperties,
      },
      {
        path: "sm-landing",
        component: SMLandingComponent,
        data: { titleId: "moreProductsFromBitwarden" },
      },
      {
        path: "request-sm-access",
        component: RequestSMAccessComponent,
        data: { titleId: "requestAccessToSecretsManager" },
      },
      {
        path: "create-organization",
        component: CreateOrganizationComponent,
        data: { titleId: "newOrganization" } satisfies RouteDataProperties,
      },
      {
        path: "settings",
        children: [
          { path: "", pathMatch: "full", redirectTo: "account" },
          {
            path: "account",
            component: AccountComponent,
            data: { titleId: "myAccount" } satisfies RouteDataProperties,
          },
          {
            path: "preferences",
            component: PreferencesComponent,
            data: { titleId: "preferences" } satisfies RouteDataProperties,
          },
          {
            path: "security",
            loadChildren: () => SecurityRoutingModule,
          },
          {
            path: "domain-rules",
            component: DomainRulesComponent,
            data: { titleId: "domainRules" } satisfies RouteDataProperties,
          },
          {
            path: "subscription",
            loadChildren: () =>
              import("./billing/individual/individual-billing.module").then(
                (m) => m.IndividualBillingModule,
              ),
          },
          {
            path: "emergency-access",
            children: [
              {
                path: "",
                component: EmergencyAccessComponent,
                data: { titleId: "emergencyAccess" } satisfies RouteDataProperties,
              },
              {
                path: ":id",
                component: EmergencyAccessViewComponent,
                data: { titleId: "emergencyAccess" } satisfies RouteDataProperties,
              },
            ],
          },
          {
            path: "sponsored-families",
            component: SponsoredFamiliesComponent,
            data: { titleId: "sponsoredFamilies" } satisfies RouteDataProperties,
          },
        ],
      },
      {
        path: "tools",
        canActivate: [authGuard],
        children: [
          { path: "", pathMatch: "full", redirectTo: "generator" },
          {
            path: "import",
            loadComponent: () =>
              import("./tools/import/import-web.component").then((mod) => mod.ImportWebComponent),
            data: {
              titleId: "importData",
            } satisfies RouteDataProperties,
          },
          {
            path: "export",
            loadComponent: () =>
              import("./tools/vault-export/export-web.component").then(
                (mod) => mod.ExportWebComponent,
              ),
            data: {
              titleId: "exportVault",
            } satisfies RouteDataProperties,
          },
          {
            path: "generator",
            component: CredentialGeneratorComponent,
            data: { titleId: "generator" } satisfies RouteDataProperties,
          },
        ],
      },
      {
        path: "reports",
        loadChildren: () => ReportsModule,
      },
      { path: "setup/families-for-enterprise", component: FamiliesForEnterpriseSetupComponent },
    ],
  },
  {
    path: "organizations",
    loadChildren: () =>
      import("./admin-console/organizations/organization.module").then((m) => m.OrganizationModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      paramsInheritanceStrategy: "always",
      // enableTracing: true,
    }),
  ],
  exports: [RouterModule],
})
export class OssRoutingModule {}

export function buildFlaggedRoute(flagName: keyof Flags, route: Route): Route {
  return flagEnabled(flagName)
    ? route
    : {
        path: route.path,
        redirectTo: "/",
      };
}
