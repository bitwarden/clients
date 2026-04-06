import { NgModule } from "@angular/core";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

@NgModule({
  imports: [BreadcrumbsComponent, BreadcrumbComponent],
  exports: [BreadcrumbsComponent, BreadcrumbComponent],
})
export class BreadcrumbsModule {}
