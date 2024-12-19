import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { Observable, firstValueFrom, map } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { NewDeviceVerificationNoticeService } from "../../../../vault/src/services/new-device-verification-notice.service";

export const NewDeviceVerificationNoticeGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
) => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const newDeviceVerificationNoticeService = inject(NewDeviceVerificationNoticeService);
  const accountService = inject(AccountService);

  if (route.queryParams["fromNewDeviceVerification"]) {
    return true;
  }

  const tempNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationTemporaryDismiss,
  );
  const permNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationPermanentDismiss,
  );

  const currentAcct$: Observable<Account | null> = accountService.activeAccount$.pipe(
    map((acct) => acct),
  );
  const currentAcct = await firstValueFrom(currentAcct$);

  if (!currentAcct) {
    return router.createUrlTree(["/login"]);
  }

  const userItems$ = newDeviceVerificationNoticeService.noticeState$(currentAcct.id);
  const userItems = await firstValueFrom(userItems$);

  if (
    userItems?.last_dismissal == null &&
    (userItems?.permanent_dismissal == null || !userItems?.permanent_dismissal) &&
    (tempNoticeFlag || permNoticeFlag)
  ) {
    return router.createUrlTree(["/new-device-notice"]);
  }

  return true;
};
