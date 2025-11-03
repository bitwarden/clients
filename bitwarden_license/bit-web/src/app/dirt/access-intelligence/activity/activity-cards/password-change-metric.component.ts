import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { switchMap, of, BehaviorSubject, combineLatest } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AllActivitiesService,
  ApplicationHealthReportDetailEnriched,
  SecurityTasksApiService,
  TaskMetrics,
  OrganizationReportSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, ProgressModule, TypographyModule } from "@bitwarden/components";

import { DefaultAdminTaskService } from "../../../../vault/services/default-admin-task.service";
import { RenderMode } from "../../models/activity.models";
import { AccessIntelligenceSecurityTasksService } from "../../shared/security-tasks.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-password-change-metric",
  imports: [CommonModule, TypographyModule, JslibModule, ProgressModule, ButtonModule],
  templateUrl: "./password-change-metric.component.html",
  providers: [AccessIntelligenceSecurityTasksService, DefaultAdminTaskService],
})
export class PasswordChangeMetricComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  protected taskMetrics$ = new BehaviorSubject<TaskMetrics>({ totalTasks: 0, completedTasks: 0 });
  private completedTasks: number = 0;
  private totalTasks: number = 0;
  private allApplicationsDetails: ApplicationHealthReportDetailEnriched[] = [];

  atRiskAppsCount: number = 0;
  atRiskPasswordsCount: number = 0;
  private organizationId!: OrganizationId;
  renderMode: RenderMode = "noCriticalApps";

  // Computed properties (formerly getters) - updated when data changes
  protected completedPercent = 0;
  protected completedTasksCount = 0;
  protected totalTasksCount = 0;
  protected canAssignTasks = false;
  protected hasExistingTasks = false;
  protected newAtRiskPasswordsCount = 0;

  constructor(
    private activatedRoute: ActivatedRoute,
    private securityTasksApiService: SecurityTasksApiService,
    private allActivitiesService: AllActivitiesService,
    protected accessIntelligenceSecurityTasksService: AccessIntelligenceSecurityTasksService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    combineLatest([this.activatedRoute.paramMap, this.allActivitiesService.taskCreatedCount$])
      .pipe(
        switchMap(([params, _]) => {
          const orgId = params.get("organizationId");
          if (orgId) {
            this.organizationId = orgId as OrganizationId;
            return this.securityTasksApiService.getTaskMetrics(this.organizationId);
          }
          return of({ totalTasks: 0, completedTasks: 0 });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((metrics) => {
        this.taskMetrics$.next(metrics);
        this.cdr.markForCheck();
      });

    combineLatest([
      this.taskMetrics$,
      this.allActivitiesService.reportSummary$,
      this.allActivitiesService.atRiskPasswordsCount$,
      this.allActivitiesService.allApplicationsDetails$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([taskMetrics, summary, atRiskPasswordsCount, allApplicationsDetails]) => {
        this.atRiskAppsCount = summary.totalCriticalAtRiskApplicationCount;
        this.atRiskPasswordsCount = atRiskPasswordsCount;
        this.completedTasks = taskMetrics.completedTasks;
        this.totalTasks = taskMetrics.totalTasks;
        this.allApplicationsDetails = allApplicationsDetails;

        // Determine render mode based on state
        this.renderMode = this.determineRenderMode(summary, taskMetrics, atRiskPasswordsCount);

        this.allActivitiesService.setPasswordChangeProgressMetricHasProgressBar(
          this.renderMode === RenderMode.criticalAppsWithAtRiskAppsAndTasks,
        );

        // Update all computed properties when data changes
        this.updateComputedProperties();

        this.cdr.markForCheck();
      });
  }

  private determineRenderMode(
    summary: OrganizationReportSummary,
    taskMetrics: TaskMetrics,
    atRiskPasswordsCount: number,
  ): RenderMode {
    // State 1: No critical apps setup
    if (summary.totalCriticalApplicationCount === 0) {
      return RenderMode.noCriticalApps;
    }

    // State 2: Critical apps with at-risk passwords but no tasks assigned yet
    // OR tasks exist but NEW at-risk passwords detected (more at-risk passwords than tasks)
    if (
      summary.totalCriticalApplicationCount > 0 &&
      (taskMetrics.totalTasks === 0 || atRiskPasswordsCount > taskMetrics.totalTasks)
    ) {
      return RenderMode.criticalAppsWithAtRiskAppsAndNoTasks;
    }

    // State 3: Critical apps with at-risk apps and tasks (progress tracking)
    if (
      summary.totalCriticalApplicationCount > 0 &&
      taskMetrics.totalTasks > 0 &&
      atRiskPasswordsCount <= taskMetrics.totalTasks
    ) {
      return RenderMode.criticalAppsWithAtRiskAppsAndTasks;
    }

    // Default to no critical apps
    return RenderMode.noCriticalApps;
  }

  /**
   * Updates all computed properties based on current state.
   * Called whenever data changes to avoid recalculation on every change detection cycle.
   */
  private updateComputedProperties(): void {
    // Calculate completion percentage
    this.completedPercent =
      this.totalTasks === 0 ? 0 : Math.round((this.completedTasks / this.totalTasks) * 100);

    // Calculate completed tasks count based on render mode
    switch (this.renderMode) {
      case RenderMode.noCriticalApps:
      case RenderMode.criticalAppsWithAtRiskAppsAndNoTasks:
        this.completedTasksCount = 0;
        break;
      case RenderMode.criticalAppsWithAtRiskAppsAndTasks:
        this.completedTasksCount = this.completedTasks;
        break;
      default:
        this.completedTasksCount = 0;
    }

    // Calculate total tasks count based on render mode
    switch (this.renderMode) {
      case RenderMode.noCriticalApps:
        this.totalTasksCount = 0;
        break;
      case RenderMode.criticalAppsWithAtRiskAppsAndNoTasks:
        this.totalTasksCount = this.atRiskAppsCount;
        break;
      case RenderMode.criticalAppsWithAtRiskAppsAndTasks:
        this.totalTasksCount = this.totalTasks;
        break;
      default:
        this.totalTasksCount = 0;
    }

    // Calculate flags and counts
    this.canAssignTasks = this.atRiskPasswordsCount > this.totalTasks;
    this.hasExistingTasks = this.totalTasks > 0;
    this.newAtRiskPasswordsCount =
      this.atRiskPasswordsCount > this.totalTasks ? this.atRiskPasswordsCount - this.totalTasks : 0;
  }

  get renderModes() {
    return RenderMode;
  }

  async assignTasks() {
    await this.accessIntelligenceSecurityTasksService.assignTasks(
      this.organizationId,
      this.allApplicationsDetails.filter((app) => app.isMarkedAsCritical),
    );
  }
}
