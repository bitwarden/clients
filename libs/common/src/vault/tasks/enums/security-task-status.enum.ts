export enum SecurityTaskStatus {
  /**
   * Default status for newly created tasks that have not been completed.
   */
  Pending = 0,

  /**
   * Status when a task is considered complete and has no remaining actions
   */
  Completed = 1,
}
