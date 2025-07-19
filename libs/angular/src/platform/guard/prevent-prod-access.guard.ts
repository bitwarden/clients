import { inject } from "@angular/core";
import { CanMatchFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";

/**
 * Guard to prevent matching routes in production environments.
 * Allows for developer tooling that should only be accessible in non-production environments.
 */
export const preventProdAccessGuard: CanMatchFn = async (): Promise<boolean> => {
  const environmentService = inject(EnvironmentService);

  const environment = await firstValueFrom(environmentService.environment$);

  if (environment.isProduction()) {
    return false;
  }

  return true;
};
