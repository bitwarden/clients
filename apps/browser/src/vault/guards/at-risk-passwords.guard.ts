import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { switchMap, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { filterOutNullish, TaskService } from "@bitwarden/vault";

export const canAccessAtRiskPasswords: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const taskService = inject(TaskService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);

  return accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) => taskService.tasksEnabled$(user.id)),
    tap((tasksEnabled) => {
      if (!tasksEnabled) {
        toastService.showToast({
          variant: "error",
          title: "",
          message: i18nService.t("accessDenied"),
        });
      }
    }),
  );
};
