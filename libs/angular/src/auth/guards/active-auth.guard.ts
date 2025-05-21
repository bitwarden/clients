import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Guard that ensures there is an active login session before allowing access
 * to the new device verification route.
 * If not, redirects to login.
 */
export function activeAuthGuard(): CanActivateFn {
  return async () => {
    const loginStrategyService = inject(LoginStrategyServiceAbstraction);
    const logService = inject(LogService);
    const router = inject(Router);

    // Check if we have a valid login session
    const authType = await firstValueFrom(loginStrategyService.currentAuthType$);
    if (authType === null) {
      logService.error("No active login session found.");
      return router.createUrlTree(["/login"]);
    }

    return true;
  };
}
