import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  Signal,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AllActivitiesService,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
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
  imports: [CommonModule, TypographyModule, JslibModule, ProgressModule, ButtonModule],
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

  // Computed properties
  readonly tasksCount = computed(() => this._tasks().length);
  readonly completedTasksCount = computed(
    () => this._tasks().filter((task) => task.status === SecurityTaskStatus.Completed).length,
  );
  readonly uncompletedTasksCount = computed(
    () => this._tasks().filter((task) => task.status == SecurityTaskStatus.Pending).length,
  );
  readonly completedTasksPercent = computed(() => {
    const total = this.tasksCount();
    // Account for case where there are no tasks to avoid NaN
    return total > 0 ? Math.round((this.completedTasksCount() / total) * 100) : 0;
  });

  readonly atRiskPasswordCount = computed<number>(() => {
    const atRiskIds = this._atRiskCipherIds();
    const tasks = this._tasks();

    if (tasks.length === 0) {
      return atRiskIds.length;
    }

    const assignedIdSet = new Set(tasks.map((task) => task.cipherId));
    const unassignedIds = atRiskIds.filter((id) => !assignedIdSet.has(id));

    return unassignedIds.length;
  });

  readonly currentView = computed<PasswordChangeView>(() => {
    if (!this._hasCriticalApplications()) {
      return PasswordChangeView.EMPTY;
    }
    if (this.tasksCount() === 0) {
      return PasswordChangeView.NO_TASKS_ASSIGNED;
    }
    if (this.atRiskPasswordCount() > 0) {
      return PasswordChangeView.NEW_TASKS_AVAILABLE;
    }
    return PasswordChangeView.PROGRESS;
  });

  constructor(
    private allActivitiesService: AllActivitiesService,
    private i18nService: I18nService,
    private injector: Injector,
    private riskInsightsDataService: RiskInsightsDataService,
    protected securityTasksService: AccessIntelligenceSecurityTasksService,
    private toastService: ToastService,
  ) {
    // Setup the _tasks signal by manually passing in the injector
    this._tasks = toSignal(this.securityTasksService.tasks$, {
      initialValue: [],
      injector: this.injector,
    });
    // Setup the _atRiskCipherIds signal by manually passing in the injector
    this._atRiskCipherIds = toSignal(
      this.riskInsightsDataService.criticalApplicationAtRiskCipherIds$,
      {
        initialValue: [],
        injector: this.injector,
      },
    );

    this._hasCriticalApplications = toSignal(
      this.riskInsightsDataService.criticalReportResults$.pipe(
        takeUntilDestroyed(this.destroyRef),
        map((report) => {
          return report != null && (report.reportData?.length ?? 0) > 0;
        }),
      ),
      {
        initialValue: false,
        injector: this.injector,
      },
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
    } catch {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
    }
  }
}
