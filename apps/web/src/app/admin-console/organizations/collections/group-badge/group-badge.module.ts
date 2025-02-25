import { NgModule } from "@angular/core";

import { SharedModule } from "../../../../shared/shared.module";
import { PipesModule } from "../../../../vault/individual-vault/pipes/pipes.module";

import { GroupNameBadgeComponent } from "./group-name-badge.component";

@NgModule({
  imports: [SharedModule, PipesModule],
  declarations: [GroupNameBadgeComponent],
  exports: [GroupNameBadgeComponent],
})
export class GroupBadgeModule {}
