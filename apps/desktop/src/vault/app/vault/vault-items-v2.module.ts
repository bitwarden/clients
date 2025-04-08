import { NgModule } from "@angular/core";

import { MenuModule } from "@bitwarden/components";

import { SharedModule } from "../../../app/shared/shared.module";

import { VaultItemsV2Component } from "./vault-items-v2.component";

@NgModule({
  declarations: [VaultItemsV2Component],
  imports: [MenuModule, SharedModule],
  exports: [VaultItemsV2Component],
})
export class VaultItemsV2Module {}
