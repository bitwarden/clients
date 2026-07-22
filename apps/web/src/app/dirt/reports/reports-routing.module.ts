import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { hasPremiumGuard } from "../../billing/guards/has-premium.guard";

import { BreachReportComponent } from "./pages/breach-report.component";
import { ExposedPasswordsReportComponent } from "./pages/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent } from "./pages/inactive-two-factor-report.component";
import { PasskeyReportComponent } from "./pages/passkey-report.component";
import { ReportsHomeComponent } from "./pages/reports-home.component";
import { ReusedPasswordsReportComponent } from "./pages/reused-passwords-report.component";
import { UnsecuredWebsitesReportComponent } from "./pages/unsecured-websites-report.component";
import { WeakPasswordsReportComponent } from "./pages/weak-passwords-report.component";
import { ReportsLayoutComponent } from "./reports-layout.component";

const routes: Routes = [
  {
    path: "",
    component: ReportsLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "",
        pathMatch: "full",
        component: ReportsHomeComponent,
        data: { titleId: "reports", homepage: true },
      },
      {
        path: "breach-report",
        component: BreachReportComponent,
        data: { titleId: "dataBreachReport" },
      },
      {
        path: "reused-passwords-report",
        component: ReusedPasswordsReportComponent,
        data: { titleId: "reusedPasswordsReport" },
        canActivate: [hasPremiumGuard()],
      },
      {
        path: "unsecured-websites-report",
        component: UnsecuredWebsitesReportComponent,
        data: { titleId: "unsecuredWebsitesReport" },
        canActivate: [hasPremiumGuard()],
      },
      {
        path: "weak-passwords-report",
        component: WeakPasswordsReportComponent,
        data: { titleId: "weakPasswordsReport" },
        canActivate: [hasPremiumGuard()],
      },
      {
        path: "exposed-passwords-report",
        component: ExposedPasswordsReportComponent,
        data: { titleId: "exposedPasswordsReport" },
        canActivate: [hasPremiumGuard()],
      },
      {
        path: "inactive-two-factor-report",
        component: InactiveTwoFactorReportComponent,
        data: { titleId: "inactive2faReport" },
        canActivate: [hasPremiumGuard()],
      },
      {
        path: "passkey-report",
        component: PasskeyReportComponent,
        data: { titleId: "passkeyLoginReport" },
        canActivate: [
          hasPremiumGuard(),
          canAccessFeature(FeatureFlag.PasskeyLoginReport, true, "/reports", false),
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsRoutingModule {}
