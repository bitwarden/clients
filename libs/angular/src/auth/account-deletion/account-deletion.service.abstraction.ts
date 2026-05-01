export abstract class AccountDeletionService {
  /**
   * Runs the full account deletion flow for the active user:
   * - Blocks if the user is managed by an organization
   * - Blocks if the user is a confirmed owner of a paid organization
   * - Warns (with confirmation) if the user is a confirmed owner of a free organization
   * - Opens the Delete Account dialog to complete deletion
   */
  abstract openDeleteAccountFlow(): Promise<void>;
}
