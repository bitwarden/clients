import { NgModule } from "@angular/core";

import { PipesModule } from "@bitwarden/vault";

import { SharedModule } from "../../../../shared/shared.module";

import { GroupNameBadgeComponent } from "./group-name-badge.component";

@NgModule({
  imports: [SharedModule, PipesModule],
  declarations: [GroupNameBadgeComponent],
  exports: [GroupNameBadgeComponent],
})
export class GroupBadgeModule {}
