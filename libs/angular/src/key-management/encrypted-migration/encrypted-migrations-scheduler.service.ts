import { combineLatest, map, switchMap, of, firstValueFrom, filter, tap, delay } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  UserKeyDefinition,
  ENCRYPTED_MIGRATION_DISK,
  StateProvider,
} from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { EncryptedMigrationsSchedulerService } from "./encrypted-migrations-scheduler.service.abstraction";
import { PromptMigrationPasswordComponent } from "./prompt-migration-password.component";

export const ENCRYPTED_MIGRATION_DISMISSED = new UserKeyDefinition<Date>(
  ENCRYPTED_MIGRATION_DISK,
  "encryptedMigrationDismissed",
  {
    deserializer: (obj: string) => (obj != null ? new Date(obj) : null),
    clearOn: [],
  },
);
const DISMISS_TIME_HOURS = 24;

type UserSyncData = {
  userId: UserId;
  lastSync: Date | null;
};

/**
 * This services schedules encrypted migrations for users on clients that are interactive (non-cli), and handles manual interaction,
 * if it is required by showing a UI prompt. It is only one means of triggering migrations, in case the user stays unlocked for a while,
 * or regularly logs in without a master-password, when the migrations do require a master-password to run.
 */
export class DefaultEncryptedMigrationsSchedulerService
  implements EncryptedMigrationsSchedulerService
{
  isMigrating = false;

  constructor(
    private syncService: SyncService,
    private accountService: AccountService,
    private stateProvider: StateProvider,
    private encryptedMigrator: EncryptedMigrator,
    private authService: AuthService,
    private logService: LogService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {
    // For all accounts, if the auth status changes to unlocked or a sync happens, prompt for migration
    this.accountService.accounts$
      .pipe(
        switchMap((accounts) => {
          const userIds = Object.keys(accounts) as UserId[];

          if (userIds.length === 0) {
            return of([]);
          }

          return combineLatest(
            userIds.map((userId) =>
              combineLatest([
                this.authService.authStatusFor$(userId),
                this.syncService.lastSync$(userId),
              ]).pipe(
                filter(([authStatus]) => authStatus === AuthenticationStatus.Unlocked),
                map(([, lastSync]) => ({ userId, lastSync }) as UserSyncData),
                delay(5_000),
                tap(({ userId }) => this.runMigrationsIfNeeded(userId)),
              ),
            ),
          );
        }),
      )
      .subscribe();
  }

  async runMigrationsIfNeeded(userId: UserId): Promise<void> {
    const authStatus = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (authStatus !== AuthenticationStatus.Unlocked) {
      return;
    }

    if (this.isMigrating || (await this.encryptedMigrator.isRunningMigrations())) {
      this.logService.info(
        `[EncryptedMigrationsScheduler] Skipping migration check for user ${userId} because migrations are already in progress`,
      );
      return;
    }

    this.isMigrating = true;
    switch (await this.encryptedMigrator.needsMigrations(userId)) {
      case "noMigrationNeeded":
        this.logService.info(
          `[EncryptedMigrationsScheduler] No migrations needed for user ${userId}`,
        );
        break;
      case "needsMigrationWithMasterPassword":
        this.logService.info(
          `[EncryptedMigrationsScheduler] User ${userId} needs migrations with master password`,
        );
        // If the user is unlocked, we can run migrations with the master password
        await this.runMigrationsWithInteraction(userId);
        break;
      case "needsMigration":
        this.logService.info(
          `[EncryptedMigrationsScheduler] User ${userId} needs migrations with master password`,
        );
        // If the user is unlocked, we can prompt for the master password
        await this.runMigrationsWithoutInteraction(userId);
        break;
    }
    this.isMigrating = false;
  }

  private async runMigrationsWithoutInteraction(userId: UserId): Promise<void> {
    try {
      await this.encryptedMigrator.runMigrations(userId, null);
    } catch (error) {
      this.logService.error(
        "[EncryptedMigrationsInitiator] Error during migration without interaction",
        error,
      );
    }
  }

  private async runMigrationsWithInteraction(userId: UserId): Promise<void> {
    // A dialog can be dismissed for a certain amount of time
    const dismissedDate = await firstValueFrom(
      this.stateProvider.getUser(userId, ENCRYPTED_MIGRATION_DISMISSED).state$,
    );
    if (dismissedDate != null) {
      const now = new Date();
      const timeDiff = now.getTime() - (dismissedDate as Date).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < DISMISS_TIME_HOURS) {
        this.logService.info(
          "[EncryptedMigrationsInitiator] Migration prompt dismissed recently, skipping for now.",
        );
        return;
      }
    }

    try {
      const dialog = PromptMigrationPasswordComponent.open(this.dialogService);
      const masterPassword = await firstValueFrom(dialog.closed);
      if (masterPassword == "") {
        await this.stateProvider.setUserState(ENCRYPTED_MIGRATION_DISMISSED, new Date(), userId);
      } else {
        await this.encryptedMigrator.runMigrations(
          userId,
          masterPassword === undefined ? null : masterPassword,
        );
      }
    } catch (error) {
      this.logService.error("[EncryptedMigrationsInitiator] Error during migration prompt", error);
      // If migrations failed when the user actively was prompted, show a toast
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("migrationsFailed"),
      });
    }
  }
}
