import { BehaviorSubject, combineLatest, from, Observable } from "rxjs";
import { map, shareReplay, switchMap, tap } from "rxjs/operators";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import {
  SecurityTasksApiService,
  TaskMetrics,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import {
  AdminTaskService,
  CreateTasksRequest,
} from "../../../../../vault/services/abstractions/admin-task.abstraction";
import { SecurityTasksService } from "../abstractions/security-tasks.service";

export class DefaultSecurityTasksService extends SecurityTasksService {
  private readonly _tasks$ = new BehaviorSubject<SecurityTask[]>([]);
  readonly tasks$ = this._tasks$.asObservable();

  readonly unassignedCriticalCipherIds$: Observable<string[]>;

  constructor(
    private readonly adminTaskService: AdminTaskService,
    private readonly securityTasksApiService: SecurityTasksApiService,
    private readonly dataService: AccessIntelligenceDataService,
  ) {
    super();

    // Derive unassigned cipher IDs by combining the loaded task list with the
    // current report. Using getCriticalAtRiskApplications() + getAtRiskCipherIds()
    // on the view model ensures the "critical only" rule is enforced in one place
    // rather than duplicated across callers.
    this.unassignedCriticalCipherIds$ = combineLatest([this.tasks$, this.dataService.report$]).pipe(
      map(([tasks, report]) => {
        if (!report) {
          return [];
        }

        const atRiskCipherIds = report
          .getCriticalAtRiskApplications()
          .flatMap((app) => app.getAtRiskCipherIds());

        if (tasks.length === 0) {
          return atRiskCipherIds;
        }

        const inProgressTaskIds = new Set<string>(
          tasks
            .filter((task) => task.status === SecurityTaskStatus.Pending && task.cipherId != null)
            .map((task) => task.cipherId as string),
        );

        const completedTaskIds = new Set<string>(
          tasks
            .filter(
              (task) =>
                task.status === SecurityTaskStatus.Completed &&
                task.cipherId != null &&
                new Date(task.revisionDate) >= report.creationDate,
            )
            .map((task) => task.cipherId as string),
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
      cipherId: cipherId as CreateTasksRequest["cipherId"],
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    return from(this.adminTaskService.bulkCreateTasks(organizationId, tasks)).pipe(
      switchMap(() => this.loadTasks$(organizationId)),
    );
  }
}
