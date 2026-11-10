import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { formatTimeOfDay } from "@bitwarden/bit-pam";
import { TimestampPipe } from "@bitwarden/bit-pam-components";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  LinkModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ROTATION_TABS, rotationLink } from "../../rotation-links";
import { AttemptView, EndingSessionsInfo, JobView } from "../rotation-job-row";

export type RotationJobDrawerParams = {
  job: JobView;
  /** Whether to name the managed credential this job rotated. */
  showCredential: boolean;
  /** The organization the credential and target system links point into. */
  organizationId?: string | null;
  /** The job's target system's session termination, or `null` to leave the field out. */
  endingSessions?: EndingSessionsInfo | null;
};

/** One rotation job in full, in the side drawer. */
@Component({
  selector: "pam-rotation-job-drawer",
  templateUrl: "./rotation-job-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableV2Component,
    DialogModule,
    I18nPipe,
    LinkModule,
    RouterLink,
    TimestampPipe,
  ],
})
export class RotationJobDrawerComponent {
  protected readonly params = inject<RotationJobDrawerParams>(DIALOG_DATA);

  protected get job(): JobView {
    return this.params.job;
  }

  private readonly locale = inject(LOCALE_ID);

  private readonly attempts = computed(() => this.params.job.attempts);

  protected readonly table = defineTable<AttemptView>(this.attempts);

  /** "7:06 PM", the time of day alone. */
  protected formatTime(iso: string): string {
    return formatTimeOfDay(this.locale, Date.parse(iso));
  }

  protected get credentialLink(): string[] | null {
    const orgId = this.params.organizationId;
    return orgId ? rotationLink(orgId, ROTATION_TABS.managedCredentials, this.job.configId) : null;
  }

  protected get targetSystemLink(): string[] | null {
    const orgId = this.params.organizationId;
    const targetId = this.job.targetSystemId;
    return orgId && targetId ? rotationLink(orgId, ROTATION_TABS.targetSystems, targetId) : null;
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
