import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, shareReplay, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AT_RISK_PASSWORDS_PAGE_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

const AUTOFILL_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  AT_RISK_PASSWORDS_PAGE_DISK,
  "autofillCalloutDismissed",
  {
    deserializer: (bannersDismissed) => bannersDismissed,
    clearOn: [], // Do not clear dismissed callout
  },
);

const GETTING_STARTED_CAROUSEL_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  AT_RISK_PASSWORDS_PAGE_DISK,
  "gettingStartedCarouselDismissed",
  {
    deserializer: (bannersDismissed) => bannersDismissed,
    clearOn: [], // Do not clear dismissed carousel
  },
);

@Injectable({
  providedIn: "root",
})
export class AtRiskPasswordPageService {
  private stateProvider = inject(StateProvider);
  private accountService = inject(AccountService);
  private taskService = inject(TaskService);
  private cipherService = inject(CipherService);

  isCalloutDismissed(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, AUTOFILL_CALLOUT_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => !!dismissed));
  }

  async dismissCallout(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, AUTOFILL_CALLOUT_DISMISSED_KEY).update(() => true);
  }

  isGettingStartedDismissed(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, GETTING_STARTED_CAROUSEL_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => !!dismissed));
  }

  async dismissGettingStarted(userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, GETTING_STARTED_CAROUSEL_DISMISSED_KEY)
      .update(() => true);
  }

  activeUserData$ = this.accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) =>
      combineLatest([
        this.taskService.pendingTasks$(user.id),
        this.cipherService.cipherViews$(user.id).pipe(
          filterOutNullish(),
          map((ciphers) => Object.fromEntries(ciphers.map((c) => [c.id, c]))),
        ),
        of(user),
      ]),
    ),
    map(([tasks, ciphers, user]) => ({
      tasks,
      ciphers,
      userId: user.id,
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  atRiskItems$ = this.activeUserData$.pipe(
    map(({ tasks, ciphers }) =>
      tasks
        .filter(
          (t) =>
            t.type === SecurityTaskType.UpdateAtRiskCredential &&
            t.cipherId != null &&
            ciphers[t.cipherId] != null &&
            ciphers[t.cipherId].edit &&
            ciphers[t.cipherId].viewPassword,
        )
        .map((t) => ciphers[t.cipherId!]),
    ),
  );
}
