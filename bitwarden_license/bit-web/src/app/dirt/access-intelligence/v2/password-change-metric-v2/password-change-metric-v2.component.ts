import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { map, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTaskStatus } from "@bitwarden/common/vault/tasks";
import {
  ButtonModule,
  ProgressModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

export const PasswordChangeView = {
  EMPTY: "empty",
  NO_TASKS_ASSIGNED: "noTasksAssigned",
  NEW_TASKS_AVAILABLE: "newTasks",
  PROGRESS: "progress",
} as const;

export type PasswordChangeView = (typeof PasswordChangeView)[keyof typeof PasswordChangeView];

/**
 * PasswordChangeMetricV2Component — Password change progress card for Access Intelligence V2
 *
 * Displays password change task progress for critical applications:
 * - EMPTY: no critical applications marked
 * - NO_TASKS_ASSIGNED: critical apps exist but no tasks sent to members
 * - NEW_TASKS_AVAILABLE: new at-risk ciphers need task assignment
 * - PROGRESS: tasks assigned, shows completion progress bar
 *
 * Key V2 changes from V1:
 * - Uses AccessIntelligenceDataService.report$ instead of RiskInsightsDataService
 * - Replaces AllActivitiesService.setExtendPasswordWidget() with output<boolean>()
 * - All service injection via inject() instead of constructor parameters
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-password-change-metric-v2",
  standalone: true,
  imports: [TypographyModule, JslibModule, ProgressModule, ButtonModule],
  templateUrl: "./password-change-metric-v2.component.html",
})
export class PasswordChangeMetricV2Component implements OnInit {
  protected readonly PasswordChangeViewEnum = PasswordChangeView;

  private readonly destroyRef = inject(DestroyRef);
  private readonly accessIntelligenceDataService = inject(AccessIntelligenceDataService);
  protected readonly securityTasksService = inject(SecurityTasksService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  // Inputs
  readonly organizationId = input.required<OrganizationId>();

  /**
   * Emits true when the PROGRESS view is active (progress bar visible),
   * false otherwise. The parent component uses this to extend the widget's
   * column span to accommodate the progress bar layout.
   *
   * Replaces V1's AllActivitiesService.setExtendPasswordWidget() call.
   */
  readonly extendWidget = output<boolean>();

  // Signal states — converted from service observables
  private readonly _tasks = toSignal(this.securityTasksService.tasks$, { initialValue: [] });
  private readonly _unassignedCipherIds = toSignal(
    this.securityTasksService.unassignedCriticalCipherIds$,
    { initialValue: [] },
  );
  private readonly _atRiskCipherIds = toSignal(
    this.accessIntelligenceDataService.report$.pipe(
      map(
        (report) =>
          report?.getCriticalAtRiskApplications().flatMap((app) => app.getAtRiskCipherIds()) ?? [],
      ),
    ),
    { initialValue: [] },
  );
  private readonly _hasCriticalApplications = toSignal(
    this.accessIntelligenceDataService.report$.pipe(
      map((report) => (report?.getCriticalApplications().length ?? 0) > 0),
    ),
    { initialValue: false },
  );

  // Computed properties
  readonly tasksCount = computed(() => this._tasks().length);
  readonly completedTasksCount = computed(
    () => this._tasks().filter((task) => task.status === SecurityTaskStatus.Completed).length,
  );
  readonly completedTasksPercent = computed(() => {
    const total = this.tasksCount();
    // Account for case where there are no tasks to avoid NaN
    return total > 0 ? Math.round((this.completedTasksCount() / total) * 100) : 0;
  });

  readonly unassignedCipherIds = computed(() => this._unassignedCipherIds().length);

  readonly atRiskPasswordCount = computed(() => {
    const atRiskIds = this._atRiskCipherIds();
    return new Set(atRiskIds).size;
  });

  readonly currentView = computed<PasswordChangeView>(() => {
    if (!this._hasCriticalApplications()) {
      return PasswordChangeView.EMPTY;
    }
    if (this.tasksCount() === 0) {
      return PasswordChangeView.NO_TASKS_ASSIGNED;
    }
    if (this._unassignedCipherIds().length > 0) {
      return PasswordChangeView.NEW_TASKS_AVAILABLE;
    }
    return PasswordChangeView.PROGRESS;
  });

  constructor() {
    // Emit extendWidget whenever currentView changes.
    // Replaces V1's AllActivitiesService.setExtendPasswordWidget() call.
    effect(() => {
      this.extendWidget.emit(this.currentView() === PasswordChangeView.PROGRESS);
    });
  }

  ngOnInit(): void {
    this.securityTasksService
      .loadTasks$(this.organizationId())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  assignTasks(): void {
    this.securityTasksService
      .requestPasswordChangeForCriticalApplications$(
        this.organizationId(),
        this._unassignedCipherIds(),
      )
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("notifiedMembers"),
            variant: "success",
            title: this.i18nService.t("success"),
          });
        },
        error: (error: unknown) => {
          if (error instanceof ErrorResponse && error.statusCode === 404) {
            this.toastService.showToast({
              message: this.i18nService.t("mustBeOrganizationOwnerAdmin"),
              variant: "error",
              title: this.i18nService.t("error"),
            });
            return;
          }

          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  }
}
