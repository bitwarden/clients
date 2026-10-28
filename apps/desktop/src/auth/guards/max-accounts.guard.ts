// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { Observable, map } from "rxjs";

import { AccountSwitcherService } from "@bitwarden/common/auth/account-switcher";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

function maxAccountsGuard(): Observable<boolean> {
  const accountSwitcherService = inject(AccountSwitcherService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);

  return accountSwitcherService.canAddAccount$.pipe(
    map((canAddAccount) => {
      if (!canAddAccount) {
        toastService.showToast({
          variant: "error",
          title: null,
          message: i18nService.t("accountLimitReached"),
        });
        return false;
      }

      return true;
    }),
  );
}

export function maxAccountsGuardFn(): CanActivateFn {
  return () => maxAccountsGuard();
}
