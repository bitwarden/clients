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
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
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

  if (authStatus === AuthenticationStatus.Locked) {
    if (routerState != null) {
      messagingService.send("lockedUrl", { url: routerState.url });
    }
    // TODO PM-9674: when extension refresh is finished, remove promptBiometric
    // as it has been integrated into the component as a default feature.
    return router.createUrlTree(["lock"], { queryParams: { promptBiometric: true } });
  }

  if (
    !routerState.url.includes("remove-password") &&
    (await keyConnectorService.getConvertAccountRequired())
  ) {
    return router.createUrlTree(["/remove-password"]);
  }

  const userId = (await firstValueFrom(accountService.activeAccount$)).id;
  const forceSetPasswordReason = await firstValueFrom(
    masterPasswordService.forceSetPasswordReason$(userId),
  );

  if (
    forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission &&
    !routerState.url.includes("set-password")
  ) {
    return router.createUrlTree(["/set-password"]);
  }

  if (
    forceSetPasswordReason !== ForceSetPasswordReason.None &&
    !routerState.url.includes("update-temp-password")
  ) {
    return router.createUrlTree(["/update-temp-password"]);
  }

  return true;
};
