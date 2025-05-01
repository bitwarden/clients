// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { Observable, map } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

const maxAllowedAccounts = 5;

function maxAccountsGuard(): Observable<boolean> {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);

  return authService.authStatuses$.pipe(
    map((statuses) =>
      Object.values(statuses).filter((status) => status != AuthenticationStatus.LoggedOut),
    ),
    map((accounts) => {
      if (accounts != null && Object.keys(accounts).length >= maxAllowedAccounts) {
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
