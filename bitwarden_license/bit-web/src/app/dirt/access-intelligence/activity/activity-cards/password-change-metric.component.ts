import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  Signal,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AllActivitiesService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus } from "@bitwarden/common/vault/tasks";
import {
  ButtonModule,
  ProgressModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { AccessIntelligenceSecurityTasksService } from "../../shared/security-tasks.service";

export const PasswordChangeView = {
  EMPTY: "empty",
  NO_TASKS_ASSIGNED: "noTasksAssigned",
  NEW_TASKS_AVAILABLE: "newTasks",
  PROGRESS: "progress",
} as const;

export type PasswordChangeView = (typeof PasswordChangeView)[keyof typeof PasswordChangeView];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-password-change-metric",
  imports: [TypographyModule, JslibModule, ProgressModule, ButtonModule],
  templateUrl: "./password-change-metric.component.html",
})
export class PasswordChangeMetricComponent implements OnInit {
  PasswordChangeViewEnum = PasswordChangeView;

  private destroyRef = inject(DestroyRef);

  // Inputs
  // Prefer component input since route param controls UI state
  readonly organizationId = input.required<OrganizationId>();

  // Signal states
  private readonly _tasks: Signal<SecurityTask[]> = signal<SecurityTask[]>([]);
  private readonly _atRiskCipherIds: Signal<CipherId[]> = signal<CipherId[]>([]);
  private readonly _hasCriticalApplications: Signal<boolean> = signal<boolean>(false);
  private readonly _reportGeneratedAt: Signal<Date | undefined> = signal<Date | undefined>(
    undefined,
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

  readonly unassignedCipherIds = computed<number>(() => {
    const atRiskIds = this._atRiskCipherIds();
    const tasks = this._tasks();

    if (tasks.length === 0) {
      return atRiskIds.length;
    }

    const inProgressTasks = tasks.filter((task) => task.status === SecurityTaskStatus.Pending);
    const inProgressTaskIds = new Set(inProgressTasks.map((task) => task.cipherId));

    const reportGeneratedAt = this._reportGeneratedAt();
    const completedTasksAfterReportGeneration = reportGeneratedAt
      ? tasks.filter(
          (task) =>
            task.status === SecurityTaskStatus.Completed &&
            new Date(task.revisionDate) >= reportGeneratedAt,
        )
      : [];
    const completedTaskIds = new Set(
      completedTasksAfterReportGeneration.map((task) => task.cipherId),
    );

    // find cipher ids from last report that do not have a corresponding in progress task (awaiting password reset) OR completed task
    const unassignedIds = atRiskIds.filter(
      (id) => !inProgressTaskIds.has(id) && !completedTaskIds.has(id),
    );

    return unassignedIds.length;
  });

  readonly atRiskPasswordCount = computed<number>(() => {
    const atRiskIds = this._atRiskCipherIds();
    const atRiskIdsSet = new Set(atRiskIds);

    return atRiskIdsSet.size;
  });

  readonly currentView = computed<PasswordChangeView>(() => {
    if (!this._hasCriticalApplications()) {
      return PasswordChangeView.EMPTY;
    }
    if (this.tasksCount() === 0) {
      return PasswordChangeView.NO_TASKS_ASSIGNED;
    }
    if (this.unassignedCipherIds() > 0) {
      return PasswordChangeView.NEW_TASKS_AVAILABLE;
    }
    return PasswordChangeView.PROGRESS;
  });

  constructor(
    private allActivitiesService: AllActivitiesService,
    private i18nService: I18nService,
    private riskInsightsDataService: RiskInsightsDataService,
    protected securityTasksService: AccessIntelligenceSecurityTasksService,
    private toastService: ToastService,
  ) {
    this._tasks = toSignal(this.securityTasksService.tasks$, { initialValue: [] });
    this._atRiskCipherIds = toSignal(
      this.riskInsightsDataService.criticalApplicationAtRiskCipherIds$,
      { initialValue: [] },
    );
    this._hasCriticalApplications = toSignal(
      this.riskInsightsDataService.criticalReportResults$.pipe(
        map((report) => {
          return report != null && (report.reportData?.length ?? 0) > 0;
        }),
      ),
      { initialValue: false },
    );
    this._reportGeneratedAt = toSignal(
      this.riskInsightsDataService.enrichedReportData$.pipe(map((report) => report?.creationDate)),
      { initialValue: undefined },
    );

    effect(() => {
      const isShowingProgress = this.currentView() === PasswordChangeView.PROGRESS;
      this.allActivitiesService.setExtendPasswordWidget(isShowingProgress);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.securityTasksService.loadTasks(this.organizationId());
  }

  async assignTasks() {
    try {
      await this.securityTasksService.requestPasswordChangeForCriticalApplications(
        this.organizationId(),
        this._atRiskCipherIds(),
      );
      this.toastService.showToast({
        message: this.i18nService.t("notifiedMembers"),
        variant: "success",
        title: this.i18nService.t("success"),
      });
    } catch (error) {
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
    }
  }
}
