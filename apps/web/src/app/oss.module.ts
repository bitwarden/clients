import { NgModule } from "@angular/core";

import { OrganizationCreateModule } from "./admin-console/organizations/create/organization-create.module";
import { OrganizationManageModule } from "./admin-console/organizations/manage/organization-manage.module";
import { OrganizationUserModule } from "./admin-console/organizations/users/organization-user.module";
import { LoginModule } from "./auth/login/login.module";
import { TrialInitiationModule } from "./auth/trial-initiation/trial-initiation.module";
import { BillingSharedModule } from "./billing/shared/billing-shared.module";
import { LooseComponentsModule, SharedModule } from "./shared";
import { OrganizationBadgeModule } from "./vault/individual-vault/organization-badge/organization-badge.module";
import { VaultFilterModule } from "./vault/individual-vault/vault-filter/vault-filter.module";

@NgModule({
  imports: [
    SharedModule,
    LooseComponentsModule,
    TrialInitiationModule,
    VaultFilterModule,
    OrganizationBadgeModule,
    OrganizationManageModule,
    OrganizationUserModule,
    OrganizationCreateModule,
    LoginModule,
    BillingSharedModule,
  ],
  exports: [
    SharedModule,
    LooseComponentsModule,
    TrialInitiationModule,
    VaultFilterModule,
    OrganizationBadgeModule,
    LoginModule,
  ],
  bootstrap: [],
})
export class OssModule {}
