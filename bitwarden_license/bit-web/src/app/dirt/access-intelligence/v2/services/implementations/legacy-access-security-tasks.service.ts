import { BehaviorSubject, combineLatest, from, Observable } from "rxjs";
import { map, shareReplay, switchMap, tap } from "rxjs/operators";

import {
  RiskInsightsDataService,
  SecurityTasksApiService,
  TaskMetrics,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import {
  AdminTaskService,
  CreateTasksRequest,
} from "../../../../../vault/services/abstractions/admin-task.abstraction";
import { AccessSecurityTasksService } from "../abstractions/access-security-tasks.service";

export class LegacyAccessSecurityTasksService extends AccessSecurityTasksService {
  private readonly _tasks$ = new BehaviorSubject<SecurityTask[]>([]);
  readonly tasks$ = this._tasks$.asObservable();

  readonly unassignedCriticalCipherIds$: Observable<CipherId[]>;

  constructor(
    private adminTaskService: AdminTaskService,
    private securityTasksApiService: SecurityTasksApiService,
    private riskInsightsDataService: RiskInsightsDataService,
  ) {
    super();

    this.unassignedCriticalCipherIds$ = combineLatest([
      this.tasks$,
      this.riskInsightsDataService.criticalApplicationAtRiskCipherIds$,
      this.riskInsightsDataService.enrichedReportData$,
    ]).pipe(
      map(([tasks, atRiskCipherIds, reportData]) => {
        if (tasks.length === 0) {
          return atRiskCipherIds;
        }

        const inProgressTaskIds = new Set(
          tasks
            .filter((task) => task.status === SecurityTaskStatus.Pending)
            .map((task) => task.cipherId),
        );

        const reportGeneratedAt = reportData?.creationDate;
        const completedTaskIds = new Set(
          (reportGeneratedAt
            ? tasks.filter(
                (task) =>
                  task.status === SecurityTaskStatus.Completed &&
                  task.cipherId != null &&
                  new Date(task.revisionDate) >= reportGeneratedAt,
              )
            : []
          ).map((task) => task.cipherId),
        );

        return atRiskCipherIds.filter(
          (id) => !inProgressTaskIds.has(id) && !completedTaskIds.has(id),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getTaskMetrics$(organizationId: OrganizationId): Observable<TaskMetrics> {
    return this.securityTasksApiService.getTaskMetrics(organizationId);
  }

  loadTasks$(organizationId: OrganizationId): Observable<void> {
    return from(this.securityTasksApiService.getAllTasks(organizationId)).pipe(
      tap((tasks) => this._tasks$.next(tasks)),
      map((): void => undefined),
    );
  }

  requestPasswordChangeForCriticalApplications$(
    organizationId: OrganizationId,
    criticalApplicationIds: string[],
  ): Observable<void> {
    const distinctCipherIds = Array.from(new Set(criticalApplicationIds));
    const tasks: CreateTasksRequest[] = distinctCipherIds.map((cipherId) => ({
      cipherId: cipherId as CipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    return from(this.adminTaskService.bulkCreateTasks(organizationId, tasks)).pipe(
      switchMap(() => this.loadTasks$(organizationId)),
    );
  }
}
