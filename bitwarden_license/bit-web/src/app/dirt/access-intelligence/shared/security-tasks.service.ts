import { BehaviorSubject } from "rxjs";

import { SecurityTasksApiService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskType } from "@bitwarden/common/vault/tasks";

import { CreateTasksRequest } from "../../../vault/services/abstractions/admin-task.abstraction";
import { DefaultAdminTaskService } from "../../../vault/services/default-admin-task.service";

/**
 * Service for managing security tasks related to Access Intelligence features
 */
export class AccessIntelligenceSecurityTasksService {
  private _tasksSubject$ = new BehaviorSubject<SecurityTask[]>([]);
  tasks$ = this._tasksSubject$.asObservable();

  constructor(
    private adminTaskService: DefaultAdminTaskService,
    private securityTasksApiService: SecurityTasksApiService,
  ) {}

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
