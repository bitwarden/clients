import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ToastService } from "@bitwarden/components";

/**
 * Wrapper around the main auth guard to redirect to login if not authenticated.
 * This is necessary because the main auth guard returns false when not authenticated,
 * which in a browser context may result in a blank extension page rather than a redirect.
 */
export const atRiskPasswordAuthGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  routerState: RouterStateSnapshot,
) => {
  const router = inject(Router);

  const authGuardResponse = await authGuard(route, routerState);
  if (authGuardResponse === true) {
    return authGuardResponse;
  }
  return router.createUrlTree(["/login"]);
};

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
