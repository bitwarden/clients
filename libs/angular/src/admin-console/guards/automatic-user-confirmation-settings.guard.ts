import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { AutomaticUserConfirmationService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ToastService } from "@bitwarden/components";

export const canAccessAutoConfirmSettings: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const autoConfirmService = inject(AutomaticUserConfirmationService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);
  const router = inject(Router);

  return accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) => autoConfirmService.canManageAutoConfirm$(user.id)),
    map((canManageAutoConfirm) => {
      if (!canManageAutoConfirm) {
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
