import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/device-management/device-management.component";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ChangePasswordComponent } from "../change-password.component";
import { TwoFactorSetupComponent } from "../two-factor/two-factor-setup.component";

import { DeviceManagementOldComponent } from "./device-management-old.component";
import { PasswordSettingsComponent } from "./password-settings/password-settings.component";
import { SecurityKeysComponent } from "./security-keys.component";
import { SecurityComponent } from "./security.component";

const routes: Routes = [
  {
    path: "",
    component: SecurityComponent,
    data: { titleId: "security" },
    children: [
      { path: "", pathMatch: "full", redirectTo: "password" },
      {
        path: "change-password",
        component: ChangePasswordComponent,
        canActivate: [
          canAccessFeature(
            FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
            false,
            "/settings/security/password",
            false,
          ),
        ],
        data: { titleId: "masterPassword" },
      },
      {
        path: "password",
        component: PasswordSettingsComponent,
        canActivate: [
          canAccessFeature(
            FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
            true,
            "/settings/security/change-password",
            false,
          ),
        ],
        data: { titleId: "masterPassword" },
      },
      {
        path: "two-factor",
        component: TwoFactorSetupComponent,
        data: { titleId: "twoStepLogin" },
      },
      {
        path: "security-keys",
        component: SecurityKeysComponent,
        data: { titleId: "keys" },
      },
      ...featureFlaggedRoute({
        defaultComponent: DeviceManagementOldComponent,
        flaggedComponent: DeviceManagementComponent,
        featureFlag: FeatureFlag.PM14938_BrowserExtensionLoginApproval,
        routeOptions: {
          path: "device-management",
          data: { titleId: "devices" },
        },
      }),
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecurityRoutingModule {}
