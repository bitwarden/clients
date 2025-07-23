// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export const authGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  routerState: RouterStateSnapshot,
): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messagingService = inject(MessagingService);
  const keyConnectorService = inject(KeyConnectorService);
  const accountService = inject(AccountService);
  const masterPasswordService = inject(MasterPasswordServiceAbstraction);

  const authStatus = await authService.getAuthStatus();

  if (authStatus === AuthenticationStatus.LoggedOut) {
    messagingService.send("authBlocked", { url: routerState.url });
    return false;
  }

  const userId = (await firstValueFrom(accountService.activeAccount$)).id;
  const forceSetPasswordReason = await firstValueFrom(
    masterPasswordService.forceSetPasswordReason$(userId),
  );

  // User JIT provisioned into a master-password-encryption org
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason === ForceSetPasswordReason.SsoNewJitProvisionedUser &&
    !routerState.url.includes("set-initial-password")
  ) {
    return router.createUrlTree(["/set-initial-password"]);
  }

  // TDE Offboarding on untrusted device
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason === ForceSetPasswordReason.TdeOffboardingUntrustedDevice &&
    !routerState.url.includes("set-initial-password")
  ) {
    return router.createUrlTree(["/set-initial-password"]);
  }

  // We must add exemptions for the SsoNewJitProvisionedUser and TdeOffboardingUntrustedDevice scenarios as
  // the "set-initial-password" route is guarded by the authGuard.
  if (
    authStatus === AuthenticationStatus.Locked &&
    forceSetPasswordReason !== ForceSetPasswordReason.SsoNewJitProvisionedUser &&
    forceSetPasswordReason !== ForceSetPasswordReason.TdeOffboardingUntrustedDevice
  ) {
    if (routerState != null) {
      messagingService.send("lockedUrl", { url: routerState.url });
    }
    // TODO PM-9674: when extension refresh is finished, remove promptBiometric
    // as it has been integrated into the component as a default feature.
    return router.createUrlTree(["lock"], { queryParams: { promptBiometric: true } });
  }

  if (
    !routerState.url.includes("remove-password") &&
    (await firstValueFrom(keyConnectorService.convertAccountRequired$))
  ) {
    return router.createUrlTree(["/remove-password"]);
  }

  // TDE org user has "manage account recovery" permission
  if (
    forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission &&
    !routerState.url.includes("set-initial-password")
  ) {
    const route = "/set-initial-password";
    return router.createUrlTree([route]);
  }

  // TDE Offboarding on trusted device
  if (
    forceSetPasswordReason === ForceSetPasswordReason.TdeOffboarding &&
    !routerState.url.includes("set-initial-password")
  ) {
    const route = "/set-initial-password";
    return router.createUrlTree([route]);
  }

  // Post- Account Recovery or Weak Password on login
  if (
    (forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset ||
      forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) &&
    !routerState.url.includes("change-password")
  ) {
    const route = "/change-password";
    return router.createUrlTree([route]);
  }

  return true;
};
