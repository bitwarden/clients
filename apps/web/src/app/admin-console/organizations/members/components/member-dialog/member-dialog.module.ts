import { NgModule } from "@angular/core";

import { RadioButtonModule } from "@bitwarden/components";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { SharedOrganizationModule } from "../../../shared";

import { MemberDialogComponent } from "./member-dialog.component";
import { NestedCheckboxComponent } from "./nested-checkbox.component";

@NgModule({
  declarations: [MemberDialogComponent],
  imports: [SharedOrganizationModule, RadioButtonModule, NestedCheckboxComponent, Vfo1I18nPipe],
  exports: [MemberDialogComponent, NestedCheckboxComponent],
})
export class UserDialogModule {}
