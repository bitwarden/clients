import { NgModule } from "@angular/core";

import { Vfo1I18nPipe } from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

import { OrganizationInformationComponent } from "./organization-information.component";

@NgModule({
  imports: [SharedModule, Vfo1I18nPipe],
  declarations: [OrganizationInformationComponent],
  exports: [OrganizationInformationComponent],
})
export class OrganizationCreateModule {}
