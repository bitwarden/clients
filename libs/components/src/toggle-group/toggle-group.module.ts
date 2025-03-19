import { NgModule } from "@angular/core";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleComponent } from "./toggle.component";

@NgModule({
  imports: [ToggleGroupComponent, ToggleComponent],
  exports: [ToggleGroupComponent, ToggleComponent],
})
export class ToggleGroupModule {}
