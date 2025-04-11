import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { NewDeviceVerificationNoticeService } from "@bitwarden/vault";

import { VaultProfileService } from "../services/vault-profile.service";

export const NewDeviceVerificationNoticeGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
) => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const newDeviceVerificationNoticeService = inject(NewDeviceVerificationNoticeService);
  const accountService = inject(AccountService);
  const platformUtilsService = inject(PlatformUtilsService);
  const vaultProfileService = inject(VaultProfileService);
  const userVerificationService = inject(UserVerificationService);

  if (route.queryParams["fromNewDeviceVerification"]) {
    return true;
  }

  const tempNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationTemporaryDismiss,
  );
  const permNoticeFlag = await configService.getFeatureFlag(
    FeatureFlag.NewDeviceVerificationPermanentDismiss,
  );

  if (!tempNoticeFlag && !permNoticeFlag) {
    return true;
  }

  const currentAcct$: Observable<Account | null> = accountService.activeAccount$;
  const currentAcct = await firstValueFrom(currentAcct$);

  if (!currentAcct) {
    return router.createUrlTree(["/login"]);
  }

  // Currently used by the auth recovery login flow and will get cleaned up in PM-18485.
  if (await firstValueFrom(newDeviceVerificationNoticeService.skipState$(currentAcct.id))) {
    return true;
  }

  try {
    const isSelfHosted = platformUtilsService.isSelfHost();
    const userIsSSOUser = await ssoAppliesToUser(
      userVerificationService,
      vaultProfileService,
      currentAcct.id,
    );
    const has2FAEnabled = await hasATwoFactorProviderEnabled(vaultProfileService, currentAcct.id);
    const isProfileLessThanWeekOld = await profileIsLessThanWeekOld(
      vaultProfileService,
      currentAcct.id,
    );

    // When any of the following are true, the device verification notice is
    // not applicable for the user. When the user has *not* logged in with their
    // master password, assume they logged in with SSO.
    if (has2FAEnabled || isSelfHosted || userIsSSOUser || isProfileLessThanWeekOld) {
      return true;
    }
  } catch {
    // Skip showing the notice if there was a problem determining applicability
    // The most likely problem to occur is the user not having a network connection
    return true;
  }

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
  userId: string,
): Promise<boolean> {
  return vaultProfileService.getProfileTwoFactorEnabled(userId);
}

/** Returns true when the user's profile is less than a week old */
async function profileIsLessThanWeekOld(
  vaultProfileService: VaultProfileService,
  userId: string,
): Promise<boolean> {
  const creationDate = await vaultProfileService.getProfileCreationDate(userId);
  return !isMoreThan7DaysAgo(creationDate);
}

/**
 * Returns true when either:
 * - The user is SSO bound to an organization and is not an Admin or Owner
 * - The user is an Admin or Owner of an organization with SSO bound and has not logged in with their master password
 *
 * NOTE: There are edge cases where this does not satisfy the original requirement of showing the notice to
 * users who are subject to the SSO required policy. When Owners and Admins log in with their MP they will see the notice
 * when they log in with SSO they will not. This is a concession made because the original logic references policies would not work for TDE users.
 * When this guard is run for those users a sync hasn't occurred and thus the policies are not available.
 */
async function ssoAppliesToUser(
  userVerificationService: UserVerificationService,
  vaultProfileService: VaultProfileService,
  userId: string,
) {
  const userSSOBound = await vaultProfileService.getUserSSOBound(userId);
  const userSSOBoundAdminOwner = await vaultProfileService.getUserSSOBoundAdminOwner(userId);
  const userLoggedInWithMP = await userLoggedInWithMasterPassword(userVerificationService, userId);

  const nonOwnerAdminSsoUser = userSSOBound && !userSSOBoundAdminOwner;
  const ssoAdminOwnerLoggedInWithMP = userSSOBoundAdminOwner && !userLoggedInWithMP;

  return nonOwnerAdminSsoUser || ssoAdminOwnerLoggedInWithMP;
}

/**
 * Returns true when the user logged in with their master password.
 */
async function userLoggedInWithMasterPassword(
  userVerificationService: UserVerificationService,
  userId: string,
) {
  return userVerificationService.hasMasterPasswordAndMasterKeyHash(userId);
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
