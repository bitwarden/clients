import { inject } from "@angular/core";
import { CanMatchFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

// TODO: should we have a devTools guard instead of prod env and self hosted env checks?
/**
 * Guard to prevent matching routes in self-hosted environments.
 * Allows for developer tooling that should only be accessible in non-self-hosted environments.
 */
export const preventSelfHostedAccessGuard: CanMatchFn = async (): Promise<boolean> => {
  const environmentService = inject(EnvironmentService);

  const environment = await firstValueFrom(environmentService.environment$);

  if (environment.isSelfHosted()) {
    return false;
  }

  return true;
};
