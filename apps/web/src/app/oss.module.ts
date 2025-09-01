import { NgModule } from "@angular/core";

import { AuthModule } from "./auth";
import { LoginModule } from "./auth/login/login.module";
import { TrialInitiationModule } from "./billing/trial-initiation/trial-initiation.module";
import { HeaderModule } from "./layouts/header/header.module";
import { SharedModule } from "./shared";
import { LooseComponentsModule } from "./shared/loose-components.module";
import { AccessComponent } from "./tools/send/send-access/access.component";
import { OrganizationBadgeModule } from "./vault/individual-vault/organization-badge/organization-badge.module";
import { VaultFilterModule } from "./vault/individual-vault/vault-filter/vault-filter.module";

// Register the locales for the application
import "./shared/locales";

@NgModule({
  imports: [
    SharedModule,
    LooseComponentsModule,
    HeaderModule,
    TrialInitiationModule,
    VaultFilterModule,
    OrganizationBadgeModule,
    LoginModule,
    AuthModule,
    AccessComponent,
  ],
  exports: [
    SharedModule,
    HeaderModule,
    TrialInitiationModule,
    VaultFilterModule,
    OrganizationBadgeModule,
    LoginModule,
    AccessComponent,
  ],
  bootstrap: [],
})
export class OssModule {}
