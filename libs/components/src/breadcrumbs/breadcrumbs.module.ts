import { NgModule } from "@angular/core";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

/**
 * Module providing breadcrumb components for navigation hierarchy display.
 */
@NgModule({
  imports: [BreadcrumbsComponent, BreadcrumbComponent],
  exports: [BreadcrumbsComponent, BreadcrumbComponent],
})
export class BreadcrumbsModule {}
