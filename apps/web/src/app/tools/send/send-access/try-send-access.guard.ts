import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";
import { from, ignoreElements, concat } from "rxjs";

import { LOG_PROVIDER } from "@bitwarden/angular/services/injection-tokens";
import { LogProvider } from "@bitwarden/logging";

import { SendAccessService } from "./send-access-service.abstraction";

export const trySendAccess: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
) => {
  const sendAccess = inject(SendAccessService);
  const log = inject<LogProvider>(LOG_PROVIDER);
  const logger = log({ function: "trySendAccess" });

  const { sendId, key } = route.params;
  if (!sendId) {
    logger.warn("sendId missing from the route parameters; redirecting to 404");
  }
  if (typeof sendId !== "string") {
    logger.panic({ expected: "string", actual: typeof sendId }, "sendId has invalid type");
  }

  if (!key) {
    logger.panic("key missing from the route parameters");
  }
  if (typeof key !== "string") {
    logger.panic({ expected: "string", actual: typeof key }, "key has invalid type");
  }

  const contextUpdated$ = from(sendAccess.setContext(sendId, key)).pipe(ignoreElements());
  const redirect$ = sendAccess.redirect$(sendId);

  // ensure the key has loaded before redirecting
  return concat(contextUpdated$, redirect$);
};
