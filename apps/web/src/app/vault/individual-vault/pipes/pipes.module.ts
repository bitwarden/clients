import { NgModule } from "@angular/core";

import { GetGroupNameFromIdPipe } from "./get-group-name.pipe";
import { GetOrgNameFromIdPipe } from "./get-organization-name.pipe";

@NgModule({
  declarations: [GetOrgNameFromIdPipe, GetGroupNameFromIdPipe],
  exports: [GetOrgNameFromIdPipe, GetGroupNameFromIdPipe],
})
export class PipesModule {}
