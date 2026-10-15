import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from "@angular/core";

import {
  BadgeModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { formatRotationTimestamp } from "../../rotation-timestamp";
import { EndingSessionsInfo, JobView } from "../rotation-job-row";

export type RotationJobDrawerParams = {
  job: JobView;
  /** Whether to name the managed credential this job rotated. */
  showCredential: boolean;
  /** The job's target system's session termination, or `null` to leave the field out. */
  endingSessions?: EndingSessionsInfo | null;
};

/** One rotation job in full, in the side drawer. */
@Component({
  selector: "pam-rotation-job-drawer",
  templateUrl: "./rotation-job-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BadgeModule, DialogModule, I18nPipe],
})
export class RotationJobDrawerComponent {
  protected readonly params = inject<RotationJobDrawerParams>(DIALOG_DATA);

  protected get job(): JobView {
    return this.params.job;
  }

  private readonly locale = inject(LOCALE_ID);

  protected formatTimestamp(iso: string): string {
    return formatRotationTimestamp(iso, this.locale);
  }

  /** "7 PM" or "7:06 PM", the time of day alone. */
  protected formatTime(iso: string): string {
    return formatRotationTimestamp(iso, this.locale).split(", ").slice(2).join(", ");
  }

  protected get endingSessions(): EndingSessionsInfo | null {
    return this.params.endingSessions ?? null;
  }

  static open(dialogService: DialogService, config: DialogConfig<RotationJobDrawerParams>) {
    return dialogService.openDrawer<unknown, RotationJobDrawerParams, RotationJobDrawerComponent>(
      RotationJobDrawerComponent,
      config,
    );
  }
}
