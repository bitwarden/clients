import { CommonModule } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ProgressModule } from "@bitwarden/components";

import {
  MemberAccessProgress,
  MemberAccessProgressConfig,
  MemberAccessProgressStep,
  calculateProgressPercentage,
} from "../model/member-access-progress";

/**
 * Loading component for Member Access Report.
 * Displays a progress bar and status messages during report generation.
 *
 * Follows the pattern established by `dirt-report-loading` in Access Intelligence,
 * but supports dynamic progress during member processing.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-member-access-loading",
  imports: [CommonModule, JslibModule, ProgressModule],
  templateUrl: "./member-access-loading.component.html",
})
export class MemberAccessLoadingComponent {
  /**
   * Current progress step.
   */
  readonly step = input<MemberAccessProgressStep>(MemberAccessProgress.FetchingMembers);

  /**
   * Number of members processed so far.
   */
  readonly processedMembers = input<number>(0);

  /**
   * Total number of members to process.
   */
  readonly totalMembers = input<number>(0);

  /**
   * Optional custom message (currently unused but kept for future extensibility).
   */
  readonly message = input<string>("");

  /**
   * Calculate the progress percentage based on current state.
   * For ProcessingMembers step, this is dynamic based on member count.
   */
  protected readonly progressPercentage = computed(() => {
    return calculateProgressPercentage({
      step: this.step(),
      processedMembers: this.processedMembers(),
      totalMembers: this.totalMembers(),
      message: this.message(),
    });
  });

  /**
   * Get the i18n message key for the current progress step.
   */
  protected readonly progressMessage = computed(() => {
    return MemberAccessProgressConfig[this.step()].messageKey;
  });

  /**
   * Show member processing count only during the ProcessingMembers step.
   */
  protected readonly showMemberProgress = computed(() => {
    return this.step() === MemberAccessProgress.ProcessingMembers && this.totalMembers() > 0;
  });

  /**
   * Get the processed member count for display.
   */
  protected readonly processedCount = computed(() => {
    return this.processedMembers().toString();
  });

  /**
   * Get the total member count for display.
   */
  protected readonly totalCount = computed(() => {
    return this.totalMembers().toString();
  });
}
