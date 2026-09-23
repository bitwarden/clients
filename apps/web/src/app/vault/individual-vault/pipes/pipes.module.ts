import { NgModule } from "@angular/core";

import { GetOrgNameFromIdPipe } from "@bitwarden/vault";

import { GetGroupNameFromIdPipe } from "./get-group-name.pipe";

@NgModule({
  imports: [GetOrgNameFromIdPipe],
  declarations: [GetGroupNameFromIdPipe],
  exports: [GetOrgNameFromIdPipe, GetGroupNameFromIdPipe],
})
export class PipesModule {}
