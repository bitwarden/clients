import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";
import { from, ignoreElements, concat } from "rxjs";

import { SendAccessAuthenticationService } from "./send-access-authentication.service";

export const trySendAccess: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const sendAccess = inject(SendAccessAuthenticationService);

  const { sendId, key } = route.params;

  const setKey$ = from(sendAccess.setKey(key)).pipe(ignoreElements());
  const redirect$ = sendAccess.redirect$(sendId);

  return concat(setKey$, redirect$);
};
