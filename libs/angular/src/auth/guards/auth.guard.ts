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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  const configService = inject(ConfigService);

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
    (await firstValueFrom(keyConnectorService.convertAccountRequired$))
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
    !routerState.url.includes("set-password") &&
    !routerState.url.includes("set-initial-password")
  ) {
    const SetInitialPasswordRefactorFlagOn = await configService.getFeatureFlag(
      FeatureFlag.PM16117_SetInitialPasswordRefactor,
    );

    const route = SetInitialPasswordRefactorFlagOn ? "/set-initial-password" : "/set-password";

    return router.createUrlTree([route]);
  }

  if (
    forceSetPasswordReason !== ForceSetPasswordReason.None &&
    !routerState.url.includes("update-temp-password")
  ) {
    return router.createUrlTree(["/update-temp-password"]);
  }

  return true;
};
