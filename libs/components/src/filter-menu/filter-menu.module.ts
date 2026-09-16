import { NgModule } from "@angular/core";

import { FilterDividerComponent } from "./filter-divider.component";
import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionDividerComponent } from "./filter-option-divider.component";
import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import { FilterToggleComponent } from "./filter-toggle.component";

const components = [
  FilterMenuComponent,
  FilterToggleComponent,
  FilterOptionComponent,
  FilterSectionComponent,
  FilterDividerComponent,
  FilterOptionDividerComponent,
];

/** Convenience module re-exporting the standalone `bit-filter-*` components. */
@NgModule({
  imports: components,
  exports: components,
})
export class FilterMenuModule {}
