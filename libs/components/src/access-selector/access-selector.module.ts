import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { BadgeModule } from "../badge";
import { FormFieldModule } from "../form-field";
import { IconButtonModule } from "../icon-button";
import { MultiSelectModule } from "../multi-select";
import { SelectModule } from "../select";
import { TableModule } from "../table";

import { AccessSelectorComponent } from "./access-selector.component";
import { UserTypePipe } from "./user-type.pipe";

@NgModule({
  imports: [
    BadgeModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    IconButtonModule,
    JslibModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectModule,
    TableModule,
  ],
  declarations: [AccessSelectorComponent, UserTypePipe],
  exports: [AccessSelectorComponent],
})
export class AccessSelectorModule {}
