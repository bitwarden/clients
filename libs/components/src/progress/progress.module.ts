import { NgModule } from "@angular/core";

import { ProgressBarLockupComponent } from "./progress-bar-lockup.component";
import { ProgressBarComponent } from "./progress.component";

@NgModule({
  imports: [ProgressBarComponent, ProgressBarLockupComponent],
  exports: [ProgressBarComponent, ProgressBarLockupComponent],
})
export class ProgressModule {}
