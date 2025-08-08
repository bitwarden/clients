import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { SharedModule } from "../../app/shared/shared.module";

@NgModule({
  imports: [SharedModule, RouterModule],
  exports: [],
})
export class LoginModule {}
