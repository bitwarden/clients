import { UserId } from "@bitwarden/common/types/guid";

export abstract class EncryptedMigrationsSchedulerService {
  /**
   * Runs migrations for a user if needed, handling both interactive and non-interactive cases
   * @param userId The user ID to run migrations for
   */
  abstract runMigrationsIfNeeded(userId: UserId): Promise<void>;
}
