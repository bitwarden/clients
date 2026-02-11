import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import { map, shareReplay } from "rxjs/operators";

import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { CreateTasksRequest } from "../../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

/**
 * Service for managing security tasks related to Access Intelligence features
 */
export class AccessIntelligenceSecurityTasksService {
  private _tasksSubject$ = new BehaviorSubject<SecurityTask[]>([]);
  tasks$ = this._tasksSubject$.asObservable();

  /**
   * Observable stream of unassigned critical cipher IDs.
   * Returns cipher IDs from critical applications that don't have an associated task
   * (either pending or completed after the report was generated).
   */
  readonly unassignedCriticalCipherIds$: Observable<CipherId[]>;

  constructor(
    private adminTaskService: DefaultAdminTaskService,
    private securityTasksApiService: SecurityTasksApiService,
    private riskInsightsDataService: RiskInsightsDataService,
  ) {
    this.unassignedCriticalCipherIds$ = combineLatest([
      this.tasks$,
      this.riskInsightsDataService.criticalApplicationAtRiskCipherIds$,
      this.riskInsightsDataService.enrichedReportData$,
    ]).pipe(
      map(([tasks, atRiskCipherIds, reportData]) => {
        // If no tasks exist, return all at-risk cipher IDs
        if (tasks.length === 0) {
          return atRiskCipherIds;
        }

        // Get in-progress tasks (awaiting password reset)
        const inProgressTasks = tasks.filter((task) => task.status === SecurityTaskStatus.Pending);
        const inProgressTaskIds = new Set(inProgressTasks.map((task) => task.cipherId));

        // Get completed tasks after report generation
        const reportGeneratedAt = reportData?.creationDate;
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

        // Filter out cipher IDs that have a corresponding in-progress or completed task
        return atRiskCipherIds.filter(
          (id) => !inProgressTaskIds.has(id) && !completedTaskIds.has(id),
        );
      }),
      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
    );
  }

  /**
   * Gets security task metrics for the given organization
   *
   * @param organizationId The organization ID
   * @returns Metrics about security tasks such as a count of completed and total tasks
   */
  getTaskMetrics(organizationId: OrganizationId) {
    return this.securityTasksApiService.getTaskMetrics(organizationId);
  }

  /**
   * Loads security tasks for the given organization and updates the internal tasks subject
   *
   * @param organizationId The organization ID
   */
  async loadTasks(organizationId: OrganizationId): Promise<void> {
    // Loads the tasks to update the service
    const tasks = await this.securityTasksApiService.getAllTasks(organizationId);
    this._tasksSubject$.next(tasks);
  }

  /**
   * Bulk assigns password change tasks for critical applications with at-risk passwords
   *
   * @param organizationId The organization ID
   * @param criticalApplicationIds IDs of critical applications with at-risk passwords
   */
  async requestPasswordChangeForCriticalApplications(
    organizationId: OrganizationId,
    criticalApplicationIds: CipherId[],
  ) {
    const distinctCipherIds = Array.from(new Set(criticalApplicationIds));
    const tasks: CreateTasksRequest[] = distinctCipherIds.map((cipherId) => ({
      cipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    await this.adminTaskService.bulkCreateTasks(organizationId, tasks);
    // Reload tasks after creation
    await this.loadTasks(organizationId);
  }
}
