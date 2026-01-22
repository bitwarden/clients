import { NgModule } from "@angular/core";

import { ProgressComponent } from "./progress.component";

/**
 * Module providing the progress component for displaying task completion status.
 */
@NgModule({
  imports: [ProgressComponent],
  exports: [ProgressComponent],
})
export class ProgressModule {}
