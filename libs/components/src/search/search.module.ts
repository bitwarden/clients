import { NgModule } from "@angular/core";

import { ButtonModule } from "../button";

import { FilterBuilderComponent } from "./filter-builder.component";
import { SearchComponent } from "./search.component";

@NgModule({
  imports: [SearchComponent, ButtonModule, FilterBuilderComponent],
  exports: [SearchComponent, FilterBuilderComponent],
})
export class SearchModule {}
