import { NgModule } from "@angular/core";

import { VaultSharedModule } from "../../vault/shared/vault-shared.module";

import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";

@NgModule({
  imports: [VaultSharedModule, VaultRoutingModule, VaultFilterModule],
  declarations: [VaultComponent],
  exports: [VaultComponent],
})
export class VaultModule {}
