import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";

import { SharedModule } from "../../app/shared/shared.module";

@NgModule({
  imports: [SharedModule, RouterModule],
  declarations: [EnvironmentSelectorComponent],
  exports: [],
})
export class LoginModule {}
