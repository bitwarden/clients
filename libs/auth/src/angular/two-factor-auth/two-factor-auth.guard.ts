import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";

import { LoginStrategyServiceAbstraction } from "../../common";

export const TwoFactorAuthGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  routerState: RouterStateSnapshot,
): Promise<boolean | UrlTree> => {
  const loginStrategyService = inject(LoginStrategyServiceAbstraction);
  const twoFactorService = inject(TwoFactorService);
  const router = inject(Router);

  const currentAuthType = await firstValueFrom(loginStrategyService.currentAuthType$);
  const userIsAuthenticating = currentAuthType !== null;

  const twoFactorProviders = await twoFactorService.getProviders();

  if (!userIsAuthenticating || twoFactorProviders == null) {
    return router.createUrlTree(["/login"]);
  }

  return true;
};
