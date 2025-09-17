import { Injectable } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_AT_RISK_PASSWORDS_DISK,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  SecurityTask,
  SecurityTaskStatus,
  SecurityTaskType,
  TaskService,
} from "@bitwarden/common/vault/tasks";
import { UserId } from "@bitwarden/user-core";

export type AtRiskPasswordCalloutData = {
  tasksBannerDismissed: boolean;
};

export const AT_RISK_PASSWORD_CALLOUT_KEY = new UserKeyDefinition<AtRiskPasswordCalloutData>(
  VAULT_AT_RISK_PASSWORDS_DISK,
  "atRiskPasswords",
  {
    deserializer: (jsonData) => jsonData,
    clearOn: ["lock", "logout"],
  },
);

@Injectable()
export class AtRiskPasswordCalloutService {
  constructor(
    private taskService: TaskService,
    private cipherService: CipherService,
    private stateProvider: StateProvider,
  ) {}

  pendingTasks$(userId: UserId): Observable<SecurityTask[]> {
    return combineLatest([
      this.taskService.pendingTasks$(userId),
      this.cipherService.cipherViews$(userId),
    ]).pipe(
      map(([tasks, ciphers]) => {
        return tasks.filter((t: SecurityTask) => {
          const associatedCipher = ciphers.find((c) => c.id === t.cipherId);

          return (
            t.type === SecurityTaskType.UpdateAtRiskCredential &&
            t.status === SecurityTaskStatus.Pending &&
            associatedCipher &&
            !associatedCipher.isDeleted
          );
        });
      }),
    );
  }

  completedTasks$(userId: UserId): Observable<SecurityTask[]> {
    return combineLatest([
      this.taskService.completedTasks$(userId),
      this.cipherService.cipherViews$(userId),
    ]).pipe(
      map(([tasks, ciphers]) => {
        return tasks.filter((t: SecurityTask) => {
          const associatedCipher = ciphers.find((c) => c.id === t.cipherId);

          return (
            t.type === SecurityTaskType.UpdateAtRiskCredential &&
            t.status === SecurityTaskStatus.Completed &&
            associatedCipher &&
            !associatedCipher.isDeleted
          );
        });
      }),
    );
  }

  showCompletedTasksBanner$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.pendingTasks$(userId),
      this.completedTasks$(userId),
      this.atRiskPasswordState(userId).state$,
    ]).pipe(
      map(([pendingTasks, completedTasks, state]) => {
        const hasPendingTasks = pendingTasks.length > 0;
        const hasCompletedTasks = completedTasks.length > 0;

        if (state?.tasksBannerDismissed) {
          return false;
        }

        if (hasPendingTasks) {
          const updateObject = {
            tasksBannerDismissed: false,
          };
          void this.atRiskPasswordState(userId).update(() => updateObject);
        }

        // Show banner if there are completed tasks and no pending tasks, and banner hasn't been dismissed
        return hasCompletedTasks && !hasPendingTasks && !(state?.tasksBannerDismissed ?? false);
      }),
    );
  }

  atRiskPasswordState(userId: UserId): SingleUserState<AtRiskPasswordCalloutData> {
    return this.stateProvider.getUser(userId, AT_RISK_PASSWORD_CALLOUT_KEY);
  }

  updateAtRiskPasswordState(userId: UserId, updatedState: AtRiskPasswordCalloutData): void {
    void this.atRiskPasswordState(userId).update(() => updatedState);
  }
}
