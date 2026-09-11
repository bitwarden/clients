import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import {
  BadgeModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RotationDurationComponent } from "../rotation-duration.component";
import { JobView } from "../rotation-job-row";

/** One job's details, plus the one thing the table already decided about how to name it. */
export type RotationJobDrawerParams = {
  job: JobView;
  /**
   * Whether to name the managed credential this job rotated.
   */
  showCredential: boolean;
};

/**
 * One rotation job read whole, in the side drawer.
 */
@Component({
  selector: "pam-rotation-job-drawer",
  templateUrl: "./rotation-job-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule, DialogModule, I18nPipe, RotationDurationComponent],
})
export class RotationJobDrawerComponent {
  protected readonly params = inject<RotationJobDrawerParams>(DIALOG_DATA);

  protected get job(): JobView {
    return this.params.job;
  }

  static open(dialogService: DialogService, config: DialogConfig<RotationJobDrawerParams>) {
    return dialogService.openDrawer<unknown, RotationJobDrawerParams, RotationJobDrawerComponent>(
      RotationJobDrawerComponent,
      config,
    );
  }
}
