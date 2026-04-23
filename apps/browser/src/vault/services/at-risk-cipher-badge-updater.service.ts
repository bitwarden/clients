import { combineLatest, concatMap, map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { Unset } from "../../platform/badge/state";

const StateName = "at-risk-cipher-badge";

export class AtRiskCipherBadgeUpdaterService {
  private activeUserData$ = this.accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) =>
      combineLatest([
        of(user.id),
        this.taskService
          .pendingTasks$(user.id)
          .pipe(
            map((tasks) => tasks.filter((t) => t.type === SecurityTaskType.UpdateAtRiskCredential)),
          ),
        // Use ciphers$ (encrypted) as a change signal only — actual decryption happens lazily
        // per tab via getAllDecryptedForUrl, which hits the warm shareReplay cache on subsequent
        // calls. This avoids triggering a write of all decrypted cipher views to
        // LocalBackedSessionStorageService on service worker startup, which causes a WASM panic
        // on wasm32 when the vault exceeds ~8 MiB of serialized data.
        this.cipherService.ciphers$(user.id),
      ]),
    ),
  );

  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private taskService: TaskService,
  ) {}

  init() {
    this.badgeService.setState(StateName, (tab) => {
      return this.activeUserData$.pipe(
        concatMap(async ([userId, pendingTasks]) => {
          const tabCiphers = tab.url
            ? await this.cipherService.getAllDecryptedForUrl(tab.url, userId, [], undefined, true)
            : [];

          const hasPendingTasksForTab = pendingTasks.some((task) =>
            tabCiphers.some((cipher) => cipher.id === task.cipherId),
          );

          if (!hasPendingTasksForTab) {
            return undefined;
          }

          return {
            priority: BadgeStatePriority.High,
            state: {
              icon: BadgeIcon.Berry,
              // Unset text and background color to use default badge appearance
              text: Unset,
              backgroundColor: Unset,
            },
          };
        }),
      );
    });
  }
}
