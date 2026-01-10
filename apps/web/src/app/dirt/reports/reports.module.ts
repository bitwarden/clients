import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { CipherFormConfigService, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";
import { OrganizationBadgeModule } from "../../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../vault/individual-vault/pipes/pipes.module";
import { RoutedVaultFilterBridgeService } from "../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
import { AdminConsoleCipherFormConfigService } from "../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { BreachReportComponent } from "./pages/breach-report.component";
import { ExposedPasswordsReportComponent } from "./pages/exposed-passwords-report.component";
import { InactiveTwoFactorReportComponent } from "./pages/inactive-two-factor-report.component";
import { ReportsHomeComponent } from "./pages/reports-home.component";
import { ReusedPasswordsReportComponent } from "./pages/reused-passwords-report.component";
import { UnsecuredWebsitesReportComponent } from "./pages/unsecured-websites-report.component";
import { WeakPasswordsReportComponent } from "./pages/weak-passwords-report.component";
import { ReportsLayoutComponent } from "./reports-layout.component";
import { ReportsRoutingModule } from "./reports-routing.module";
import { ReportsSharedModule } from "./shared";

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    ReportsSharedModule,
    ReportsRoutingModule,
    OrganizationBadgeModule,
    PipesModule,
    HeaderModule,
  ],
  declarations: [
    BreachReportComponent,
    ExposedPasswordsReportComponent,
    InactiveTwoFactorReportComponent,
    ReportsLayoutComponent,
    ReportsHomeComponent,
    ReusedPasswordsReportComponent,
    UnsecuredWebsitesReportComponent,
    WeakPasswordsReportComponent,
  ],
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: DefaultCipherFormConfigService,
    },
    RoutedVaultFilterService,
    AdminConsoleCipherFormConfigService,
    RoutedVaultFilterBridgeService,
  ],
})
export class ReportsModule {}
