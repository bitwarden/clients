import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";

/**
 * Request type for creating tasks.
 * @property cipherId - Optional. The ID of the cipher to create the task for.
 * @property type - The type of task to create. Currently defined as "updateAtRiskCredential".
 */
export type CreateTasksRequest = Readonly<{
  cipherId?: CipherId;
  type: typeof SecurityTaskType.UpdateAtRiskCredential;
}>;

export abstract class AdminTaskService {
  /**
   * Retrieves all tasks for a given organization.
   * @param organizationId - The ID of the organization to retrieve tasks for.
   * @param status - Optional. The status of the tasks to retrieve.
   */
  abstract getAllTasks(
    organizationId: OrganizationId,
    status?: SecurityTaskStatus | undefined,
  ): Promise<SecurityTask[]>;

  /**
   * Creates multiple tasks for a given organization and sends out notifications to applicable users.
   * @param organizationId - The ID of the organization to create tasks for.
   * @param tasks - The tasks to create.
   */
  abstract bulkCreateTasks(
    organizationId: OrganizationId,
    tasks: CreateTasksRequest[],
  ): Promise<void>;
}
