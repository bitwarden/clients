import { NgModule } from "@angular/core";

import { SharedModule } from "../../../../../shared";

import { AccessSelectorComponent } from "./access-selector.component";
import { UserTypePipe } from "./user-type.pipe";

@NgModule({
  imports: [SharedModule],
  declarations: [AccessSelectorComponent, UserTypePipe],
  exports: [AccessSelectorComponent],
})
export class AccessSelectorModule {}
