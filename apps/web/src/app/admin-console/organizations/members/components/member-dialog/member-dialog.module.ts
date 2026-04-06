import { NgModule } from "@angular/core";

import { RadioButtonModule } from "@bitwarden/components";

import { SharedOrganizationModule } from "../../../shared";

import { MemberDialogComponent } from "./member-dialog.component";
import { NestedCheckboxComponent } from "./nested-checkbox.component";

@NgModule({
  declarations: [MemberDialogComponent, NestedCheckboxComponent],
  imports: [SharedOrganizationModule, RadioButtonModule],
  exports: [MemberDialogComponent],
})
export class UserDialogModule {}
