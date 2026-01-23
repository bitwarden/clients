import { NgModule } from "@angular/core";

import { GetOrgNameFromIdPipe } from "@bitwarden/vault";

import { GetGroupNameFromIdPipe } from "./get-group-name.pipe";

@NgModule({
  declarations: [GetOrgNameFromIdPipe, GetGroupNameFromIdPipe],
  exports: [GetOrgNameFromIdPipe, GetGroupNameFromIdPipe],
})
export class PipesModule {}
