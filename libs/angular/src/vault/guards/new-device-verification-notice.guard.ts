import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { Observable, firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NewDeviceVerificationNoticeService } from "../../../../vault/src/services/new-device-verification-notice.service";
import { VaultProfileService } from "../services/vault-profile.service";

export const NewDeviceVerificationNoticeGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
) => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const newDeviceVerificationNoticeService = inject(NewDeviceVerificationNoticeService);
  const accountService = inject(AccountService);
  const platformUtilsService = inject(PlatformUtilsService);
  const policyService = inject(PolicyService);
  const vaultProfileService = inject(VaultProfileService);

  if (route.queryParams["fromNewDeviceVerification"]) {
    return true;
  }

  const currentAcct$: Observable<Account | null> = accountService.activeAccount$.pipe(
    map((acct) => acct),
  );
  const currentAcct = await firstValueFrom(currentAcct$);

  if (!currentAcct) {
    return router.createUrlTree(["/login"]);
  }

  const has2FAEnabled = await hasATwoFactorProviderEnabled(vaultProfileService);
  const isSelfHosted = await platformUtilsService.isSelfHost();
  const requiresSSO = await isSSORequired(policyService);
  const isProfileLessThanWeekOld = await profileIsLessThanWeekOld(vaultProfileService);

  // When any of the following are true, the device verification notice is
  // not applicable for the user.
  if (has2FAEnabled || isSelfHosted || requiresSSO || isProfileLessThanWeekOld) {
    return true;
  }

  const tempNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationTemporaryDismiss,
  );
  const permNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationPermanentDismiss,
  );

  const userItems$ = newDeviceVerificationNoticeService.noticeState$(currentAcct.id);
  const userItems = await firstValueFrom(userItems$);

  // Show the notice when:
  // - The temp notice flag is enabled
  // - The user hasn't dismissed the notice or the user dismissed it more than 7 days ago
  if (
    tempNoticeFlag &&
    (!userItems?.last_dismissal || isMoreThan7DaysAgo(userItems?.last_dismissal))
  ) {
    return router.createUrlTree(["/new-device-notice"]);
  }

  // Show the notice when:
  // - The permanent notice flag is enabled
  // - The user hasn't dismissed the notice
  if (permNoticeFlag && !userItems?.permanent_dismissal) {
    return router.createUrlTree(["/new-device-notice"]);
  }

  return true;
};

/** Returns true has one 2FA provider enabled */
async function hasATwoFactorProviderEnabled(
  vaultProfileService: VaultProfileService,
): Promise<boolean> {
  return vaultProfileService.getProfileTwoFactorEnabled();
}

/** Returns true when the user's profile is less than a week old */
async function profileIsLessThanWeekOld(
  vaultProfileService: VaultProfileService,
): Promise<boolean> {
  const creationDate = await vaultProfileService.getProfileCreationDate();
  return !isMoreThan7DaysAgo(creationDate);
}

/** Returns true when the user is required to login via SSO */
async function isSSORequired(policyService: PolicyService) {
  return firstValueFrom(policyService.policyAppliesToActiveUser$(PolicyType.RequireSso));
}

/** Returns the true when the date given is older than 7 days */
function isMoreThan7DaysAgo(date?: string | Date): boolean {
  if (!date) {
    return false;
  }

  const inputDate = new Date(date).getTime();
  const today = new Date().getTime();

  const differenceInMS = today - inputDate;
  const msInADay = 1000 * 60 * 60 * 24;
  const differenceInDays = Math.round(differenceInMS / msInADay);

  return differenceInDays > 7;
}
