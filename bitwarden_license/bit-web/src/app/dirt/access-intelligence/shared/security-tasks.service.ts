import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { CreateTasksRequest } from "../../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

@Injectable()
export class AccessIntelligenceSecurityTasksService {
  private _tasksSubject$ = new BehaviorSubject<SecurityTask[]>([]);
  tasks$ = this._tasksSubject$.asObservable();

  constructor(
    private adminTaskService: DefaultAdminTaskService,
    private securityTasksApiService: SecurityTasksApiService,
  ) {}

  async loadTasks(organizationId: OrganizationId): Promise<void> {
    // Loads the tasks to update the service
    const tasks = await this.securityTasksApiService.getAllTasks(organizationId);
    this._tasksSubject$.next(tasks);
  }
  getTaskMetrics(organizationId: OrganizationId) {
    return this.securityTasksApiService.getTaskMetrics(organizationId);
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
      cipherId: cipherId as CipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
    }));

    await this.adminTaskService.bulkCreateTasks(organizationId, tasks);
  }
}
