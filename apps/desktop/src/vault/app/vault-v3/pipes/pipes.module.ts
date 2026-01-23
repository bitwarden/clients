import { NgModule } from "@angular/core";

import { GetOrgNameFromIdPipe } from "@bitwarden/vault";

@NgModule({
  declarations: [GetOrgNameFromIdPipe],
  exports: [GetOrgNameFromIdPipe],
})
export class PipesModule {}
