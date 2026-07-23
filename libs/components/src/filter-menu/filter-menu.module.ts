import { NgModule } from "@angular/core";

import { FilterDividerComponent } from "./filter-divider.component";
import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import { FilterToggleComponent } from "./filter-toggle.component";

// No separate group or search component: the chip carries `multiple` for single-
// vs multi-select and renders its own `bit-search`; consumers project options.
const components = [
  FilterMenuComponent,
  FilterToggleComponent,
  FilterOptionComponent,
  FilterSectionComponent,
  FilterDividerComponent,
];

/** Convenience module re-exporting the standalone `bit-filter-*` components. */
@NgModule({
  imports: components,
  exports: components,
})
export class FilterMenuModule {}
