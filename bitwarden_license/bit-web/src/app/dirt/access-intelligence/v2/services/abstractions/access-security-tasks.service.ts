import { Observable } from "rxjs";

import { TaskMetrics } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SecurityTask } from "@bitwarden/common/vault/tasks";

/**
 * Manages security tasks for Access Intelligence.
 *
 * Provides a reactive view of current tasks and derived state for which
 * critical cipher IDs still need password-change requests. Implementations
 * differ in which report data source they use to compute unassigned cipher IDs.
 */
export abstract class AccessSecurityTasksService {
  /**
   * Current security tasks for the active organization.
   *
   * Emits the latest loaded task list. Empty array until {@link loadTasks$} is called.
   *
   * @example
   * ```typescript
   * this.accessSecurityTasksService.tasks$.subscribe(tasks => {
   *   console.log(`${tasks.length} tasks loaded`);
   * });
   * ```
   */
  abstract readonly tasks$: Observable<SecurityTask[]>;

  /**
   * Cipher IDs of critical at-risk passwords that have no active or recently
   * completed security task.
   *
   * A cipher ID is considered "unassigned" when:
   * - No task with status Pending references it, AND
   * - No task with status Completed references it with a completion date
   *   after the current report was generated.
   *
   * This observable is the single source of truth for which ciphers still
   * need a password-change request. Multiple components can subscribe without
   * duplicating the computation.
   *
   * @example
   * ```typescript
   * this.accessSecurityTasksService.unassignedCriticalCipherIds$.subscribe(ids => {
   *   this.enableRequestButton = ids.length > 0;
   * });
   * ```
   */
  abstract readonly unassignedCriticalCipherIds$: Observable<string[]>;

  /**
   * Fetch task completion metrics for the given organization.
   *
   * @param organizationId - The organization to fetch metrics for
   * @returns Observable emitting completed and total task counts
   *
   * @example
   * ```typescript
   * this.accessSecurityTasksService.getTaskMetrics$(orgId).subscribe(metrics => {
   *   console.log(`${metrics.completedTasks} / ${metrics.totalTasks} complete`);
   * });
   * ```
   */
  abstract getTaskMetrics$(organizationId: OrganizationId): Observable<TaskMetrics>;

  /**
   * Load security tasks for the given organization.
   *
   * Fetches tasks from the API and updates the internal subject, causing
   * {@link tasks$} and {@link unassignedCriticalCipherIds$} to re-emit.
   *
   * @param organizationId - The organization to load tasks for
   * @returns Observable that completes when tasks are loaded
   *
   * @example
   * ```typescript
   * this.accessSecurityTasksService.loadTasks$(orgId).subscribe();
   * ```
   */
  abstract loadTasks$(organizationId: OrganizationId): Observable<void>;

  /**
   * Bulk-request password changes for critical at-risk ciphers.
   *
   * Creates one pending task per cipher ID, then reloads tasks so that
   * {@link unassignedCriticalCipherIds$} updates immediately.
   *
   * @param organizationId - The organization the ciphers belong to
   * @param criticalApplicationIds - Cipher IDs that need password-change requests
   * @returns Observable that completes when tasks are created and reloaded
   *
   * @example
   * ```typescript
   * this.accessSecurityTasksService
   *   .requestPasswordChangeForCriticalApplications$(orgId, this.unassignedCipherIds())
   *   .subscribe();
   * ```
   */
  abstract requestPasswordChangeForCriticalApplications$(
    organizationId: OrganizationId,
    criticalApplicationIds: string[],
  ): Observable<void>;
}
