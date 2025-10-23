import { CommonModule } from "@angular/common";
import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, switchMap, takeUntil, of, BehaviorSubject, combineLatest } from "rxjs";

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
  protected taskMetrics$ = new BehaviorSubject<TaskMetrics>({ totalTasks: 0, completedTasks: 0 });
  private completedTasks: number = 0;
  private totalTasks: number = 0;
  private allApplicationsDetails: ApplicationHealthReportDetailEnriched[] = [];

  atRiskAppsCount: number = 0;
  atRiskPasswordsCount: number = 0;
  private organizationId!: OrganizationId;
  private destroyRef = new Subject<void>();
  renderMode: RenderMode = "noCriticalApps";

  constructor(
    private activatedRoute: ActivatedRoute,
    private securityTasksApiService: SecurityTasksApiService,
    private allActivitiesService: AllActivitiesService,
    protected accessIntelligenceSecurityTasksService: AccessIntelligenceSecurityTasksService,
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
        takeUntil(this.destroyRef),
      )
      .subscribe((metrics) => {
        this.taskMetrics$.next(metrics);
      });

    combineLatest([
      this.taskMetrics$,
      this.allActivitiesService.reportSummary$,
      this.allActivitiesService.atRiskPasswordsCount$,
      this.allActivitiesService.allApplicationsDetails$,
    ])
      .pipe(takeUntil(this.destroyRef))
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

  get completedPercent(): number {
    if (this.totalTasks === 0) {
      return 0;
    }
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }

  get completedTasksCount(): number {
    switch (this.renderMode) {
      case RenderMode.noCriticalApps:
      case RenderMode.criticalAppsWithAtRiskAppsAndNoTasks:
        return 0;

      case RenderMode.criticalAppsWithAtRiskAppsAndTasks:
        return this.completedTasks;

      default:
        return 0;
    }
  }

  get totalTasksCount(): number {
    switch (this.renderMode) {
      case RenderMode.noCriticalApps:
        return 0;

      case RenderMode.criticalAppsWithAtRiskAppsAndNoTasks:
        return this.atRiskAppsCount;

      case RenderMode.criticalAppsWithAtRiskAppsAndTasks:
        return this.totalTasks;

      default:
        return 0;
    }
  }

  get canAssignTasks(): boolean {
    return this.atRiskPasswordsCount > this.totalTasks;
  }

  get hasExistingTasks(): boolean {
    return this.totalTasks > 0;
  }

  get newAtRiskPasswordsCount(): number {
    // Calculate new at-risk passwords as the difference between current count and tasks created
    if (this.atRiskPasswordsCount > this.totalTasks) {
      return this.atRiskPasswordsCount - this.totalTasks;
    }
    return 0;
  }

  get renderModes() {
    return RenderMode;
  }

  async assignTasks() {
    await this.accessIntelligenceSecurityTasksService.assignTasks(
      this.organizationId,
      this.allApplicationsDetails,
    );
  }
}
