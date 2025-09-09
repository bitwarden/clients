import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ToastService } from "@bitwarden/components";

export const canAccessAtRiskPasswords: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const taskService = inject(TaskService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);
  const router = inject(Router);

  return accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) => taskService.tasksEnabled$(user.id)),
    map((tasksEnabled) => {
      if (!tasksEnabled) {
        toastService.showToast({
          variant: "error",
          title: "",
          message: i18nService.t("noPermissionsViewPage"),
        });

        return router.createUrlTree(["/tabs/vault"]);
      }
      return true;
    }),
  );
};

export const hasAtRiskPasswords: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const taskService = inject(TaskService);
  const cipherService = inject(CipherService);
  const router = inject(Router);

  return accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) =>
      combineLatest([
        taskService.pendingTasks$(user.id),
        cipherService.cipherViews$(user.id).pipe(
          filterOutNullish(),
          map((ciphers) => Object.fromEntries(ciphers.map((c) => [c.id, c]))),
        ),
      ]).pipe(
        map(([tasks, ciphers]) => {
          const hasAtRiskCiphers = tasks.some(
            (t) =>
              t.type === SecurityTaskType.UpdateAtRiskCredential &&
              t.cipherId != null &&
              ciphers[t.cipherId] != null &&
              !ciphers[t.cipherId].isDeleted,
          );

          if (!hasAtRiskCiphers) {
            return router.createUrlTree(["/tabs/vault"]);
          }
          return true;
        }),
      ),
    ),
  );
};
