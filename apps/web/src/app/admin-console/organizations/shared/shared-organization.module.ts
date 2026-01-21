import { NgModule } from "@angular/core";

import { AccessSelectorModule, SearchModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared/shared.module";

@NgModule({
  imports: [SharedModule, AccessSelectorModule, SearchModule],
  declarations: [],
  exports: [SharedModule, AccessSelectorModule, SearchModule],
})
export class SharedOrganizationModule {}
