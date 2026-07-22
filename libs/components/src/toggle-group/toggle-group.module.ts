import { NgModule } from "@angular/core";

import { ToggleDropdownComponent } from "./toggle-dropdown.component";
import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleComponent } from "./toggle.component";

@NgModule({
  imports: [ToggleDropdownComponent, ToggleGroupComponent, ToggleComponent],
  exports: [ToggleDropdownComponent, ToggleGroupComponent, ToggleComponent],
})
export class ToggleGroupModule {}
