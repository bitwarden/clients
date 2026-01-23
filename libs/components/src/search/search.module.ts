import { NgModule } from "@angular/core";

import { SearchComponent } from "./search.component";

/**
 * Module providing the search component for text filtering.
 */
@NgModule({
  imports: [SearchComponent],
  exports: [SearchComponent],
})
export class SearchModule {}
