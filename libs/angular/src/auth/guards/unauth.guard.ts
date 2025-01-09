import { inject } from "@angular/core";
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { Observable, map } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

type UnauthRoutes = {
  homepage: () => string;
  locked: string;
};

const defaultRoutes: UnauthRoutes = {
  homepage: () => "/vault",
  locked: "/lock",
};

function unauthGuard(routes: UnauthRoutes): Observable<boolean | UrlTree> {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.activeAccountStatus$.pipe(
    map((status) => {
      if (status == null || status === AuthenticationStatus.LoggedOut) {
        return true;
      } else if (status === AuthenticationStatus.Locked) {
        return router.createUrlTree([routes.locked]);
      } else {
        return router.createUrlTree([routes.homepage()]);
      }
    }),
  );
}

export function unauthGuardFn(overrides: Partial<UnauthRoutes> = {}): CanActivateFn {
  return () => unauthGuard({ ...defaultRoutes, ...overrides });
}
