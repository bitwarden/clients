import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { ChangePasswordComponent } from "../change-password.component";
import { TwoFactorSetupComponent } from "../two-factor/two-factor-setup.component";

import { DeviceManagementComponent } from "./device-management.component";
import { SecurityKeysComponent } from "./security-keys.component";
import { SecurityComponent } from "./security.component";

const routes: Routes = [
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
      {
        path: "device-management",
        component: DeviceManagementComponent,
        data: { titleId: "devices" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecurityRoutingModule {}
