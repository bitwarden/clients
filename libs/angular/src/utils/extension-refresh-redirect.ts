import { inject } from "@angular/core";
import { UrlTree, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";

/**
 * Helper function to redirect to a new URL based on the ExtensionRefresh feature flag.
 * @param redirectUrl - The URL to redirect to if the ExtensionRefresh flag is enabled.
 */
export function extensionRefreshRedirect(redirectUrl: string): () => Promise<boolean | UrlTree> {
  return async () => {
    const labsSettingsService = inject(LabsSettingsServiceAbstraction);
    const router = inject(Router);
    const shouldRedirect = await firstValueFrom(labsSettingsService.resolvedDesignRefreshEnabled$);
    if (shouldRedirect) {
      return router.parseUrl(redirectUrl);
    } else {
      return true;
    }
  };
}
