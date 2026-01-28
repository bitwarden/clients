import { CommonModule } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ProgressModule } from "@bitwarden/components";

import {
  MemberAccessProgress,
  MemberAccessProgressConfig,
  MemberAccessProgressState,
  calculateProgressPercentage,
} from "./model/member-access-progress";

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
  template: `
    <div class="tw-flex tw-justify-center tw-items-center tw-min-h-[60vh]">
      <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
        <!-- Progress bar -->
        <div class="tw-w-64" role="progressbar" [attr.aria-label]="'loadingProgress' | i18n">
          <bit-progress
            [barWidth]="progressPercentage()"
            [showText]="false"
            size="default"
            bgColor="primary"
          ></bit-progress>
        </div>

        <!-- Status message and subtitle -->
        <div class="tw-text-center tw-flex tw-flex-col tw-gap-1">
          <span class="tw-text-main tw-text-base tw-font-medium tw-leading-4">
            {{ progressMessage() | i18n }}
          </span>
          @if (showMemberProgress()) {
            <span class="tw-text-muted tw-text-sm tw-font-normal tw-leading-4">
              {{ "processingXOfYMembers" | i18n: processedCount() : totalCount() }}
            </span>
          } @else {
            <span class="tw-text-muted tw-text-sm tw-font-normal tw-leading-4">
              {{ "thisMightTakeFewMinutes" | i18n }}
            </span>
          }
        </div>
      </div>
    </div>
  `,
})
export class MemberAccessLoadingComponent {
  /**
   * Progress state input from parent component.
   * Recommended: delay emissions to this input to ensure each step displays for a minimum time.
   */
  readonly progressState = input<MemberAccessProgressState>({
    step: MemberAccessProgress.FetchingMembers,
    processedMembers: 0,
    totalMembers: 0,
    message: "",
  });

  /**
   * Calculate the progress percentage based on current state.
   * For ProcessingMembers step, this is dynamic based on member count.
   */
  protected readonly progressPercentage = computed(() => {
    return calculateProgressPercentage(this.progressState());
  });

  /**
   * Get the i18n message key for the current progress step.
   */
  protected readonly progressMessage = computed(() => {
    const state = this.progressState();
    return MemberAccessProgressConfig[state.step].messageKey;
  });

  /**
   * Show member processing count only during the ProcessingMembers step.
   */
  protected readonly showMemberProgress = computed(() => {
    const state = this.progressState();
    return state.step === MemberAccessProgress.ProcessingMembers && state.totalMembers > 0;
  });

  /**
   * Get the processed member count for display.
   */
  protected readonly processedCount = computed(() => {
    return this.progressState().processedMembers.toString();
  });

  /**
   * Get the total member count for display.
   */
  protected readonly totalCount = computed(() => {
    return this.progressState().totalMembers.toString();
  });
}
