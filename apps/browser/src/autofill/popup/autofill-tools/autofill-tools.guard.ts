import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { devFlagEnabled } from "../../../platform/flags";

/**
 * Gates the autofill dev tools (triage + webmapper) behind the `fillAssistDevTools`
 * dev flag. The flag is only ever on in development builds, so this route is
 * unreachable in production. Redirects to the vault when the flag is off.
 */
export const autofillToolsDevFlagGuard: CanActivateFn = (_route, _state) => {
  if (devFlagEnabled("fillAssistDevTools")) {
    return true;
  }
  return inject(Router).createUrlTree(["/tabs/vault"]);
};
