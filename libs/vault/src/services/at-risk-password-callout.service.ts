import { Injectable } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_AT_RISK_PASSWORDS_MEMORY,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { UserId } from "@bitwarden/user-core";

export type AtRiskPasswordCalloutData = {
  hasInteractedWithTasks: boolean;
  tasksBannerDismissed: boolean;
};

export const AT_RISK_PASSWORD_CALLOUT_KEY = new UserKeyDefinition<AtRiskPasswordCalloutData>(
  VAULT_AT_RISK_PASSWORDS_MEMORY,
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
            associatedCipher &&
            !associatedCipher.isDeleted
          );
        });
      }),
    );
  }

  completedTasks$(userId: UserId): Observable<SecurityTask | undefined> {
    return this.taskService.completedTasks$(userId).pipe(
      map((tasks) => {
        return tasks.find((t: SecurityTask) => t.type === SecurityTaskType.UpdateAtRiskCredential);
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
        const bannerDismissed = state?.tasksBannerDismissed ?? false;
        const hasInteracted = state?.hasInteractedWithTasks ?? false;

        // This will ensure the banner remains visible only in the client the user resolved their tasks in
        // e.g. if the user did not see tasks in the browser, and resolves them in the web, the browser will not show the banner
        if (!hasPendingTasks && (!hasInteracted || bannerDismissed)) {
          return false;
        }

        if (hasPendingTasks) {
          void this.atRiskPasswordState(userId).update(() => ({
            hasInteractedWithTasks: true,
            tasksBannerDismissed: false,
          }));
        }

        // Show banner if there are completed tasks and no pending tasks, and banner hasn't been dismissed
        return !!completedTasks && !hasPendingTasks && !(state?.tasksBannerDismissed ?? false);
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
