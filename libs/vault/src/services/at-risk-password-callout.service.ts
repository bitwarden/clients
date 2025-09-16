import { Injectable } from "@angular/core";
import { combineLatest, map, Observable, take, tap } from "rxjs";

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
  hadPendingTasks: boolean;
  showTasksCompleteBanner: boolean;
  tasksBannerDismissed: boolean;
};

export const AT_RISK_PASSWORD_CALLOUT_KEY = new UserKeyDefinition<AtRiskPasswordCalloutData>(
  VAULT_AT_RISK_PASSWORDS_MEMORY,
  "atRiskPasswords",
  {
    deserializer: (jsonData) => jsonData,
    clearOn: [],
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

  shouldShowCompletionBanner$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.pendingTasks$(userId),
      this.atRiskPasswordState(userId).state$,
    ]).pipe(
      map(([pendingTasks, state]) => {
        const hasPendingTasks = pendingTasks.length > 0;
        const {
          showTasksCompleteBanner = false,
          hadPendingTasks = false,
          tasksBannerDismissed = false,
        } = state ?? {};

        // Show banner if
        // user has resolved all pending tasks
        // user had showTasksCompleteBanner set to true and hasn't received new tasks
        // user had showTasksCompleteBanner set to true and hasn't dismissed
        return (
          !hasPendingTasks && (showTasksCompleteBanner || hadPendingTasks) && !tasksBannerDismissed
        );
      }),
    );
  }

  atRiskPasswordState(userId: UserId): SingleUserState<AtRiskPasswordCalloutData> {
    return this.stateProvider.getUser(userId, AT_RISK_PASSWORD_CALLOUT_KEY);
  }

  updateAtRiskPasswordState(userId: UserId, updatedState: AtRiskPasswordCalloutData): void {
    void this.atRiskPasswordState(userId).update(() => updatedState);
  }

  updatePendingTasksState(userId: UserId, currentTaskCount: number): void {
    this.atRiskPasswordState(userId)
      .state$.pipe(
        take(1),
        tap((currentState) => {
          let updateObject: AtRiskPasswordCalloutData | null = null;

          // If user had pending tasks and resolved all, show banner
          if (currentState?.hadPendingTasks && currentTaskCount === 0) {
            updateObject = {
              hadPendingTasks: false,
              showTasksCompleteBanner: true,
              tasksBannerDismissed: false,
            };
            // If user has pending tasks, set hadPendingTasks to true
          } else if (currentTaskCount > 0) {
            updateObject = {
              hadPendingTasks: true,
              showTasksCompleteBanner: false,
              tasksBannerDismissed: false,
            };
          }

          if (updateObject) {
            this.updateAtRiskPasswordState(userId, updateObject);
          }
        }),
      )
      .subscribe();
  }
}
