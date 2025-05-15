import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { DeviceManagementComponent } from "@bitwarden/angular/auth/components/device-management/device-management.component";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ChangePasswordComponent } from "../change-password.component";
import { TwoFactorSetupComponent } from "../two-factor/two-factor-setup.component";

import { DeviceManagementOldComponent } from "./device-management-old.component";
import { SecurityKeysComponent } from "./security-keys.component";
import { SecurityComponent } from "./security.component";

export const routes: Routes = [
  {
    path: "",
    component: SecurityComponent,
    data: { titleId: "security" },
    children: [
      { path: "", pathMatch: "full", redirectTo: "change-password" },
      {
        path: "change-password",
        component: ChangePasswordComponent,
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
        featureFlag: FeatureFlag.PM14939_ExtensionApproval,
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
