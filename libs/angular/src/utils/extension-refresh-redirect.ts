import { inject } from "@angular/core";
import { UrlTree, Router } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Helper function to redirect to a new URL based on the ExtensionRefresh feature flag.
 * @param redirectUrl - The URL to redirect to if the ExtensionRefresh flag is enabled.
 */
export function extensionRefreshRedirect(redirectUrl: string): () => Promise<boolean | UrlTree> {
  return async () => {
    const configService = inject(ConfigService);
    const router = inject(Router);

    const shouldRedirect = await configService.getFeatureFlag(FeatureFlag.ExtensionRefresh);
    if (shouldRedirect) {
      const currentNavigation = router.getCurrentNavigation();
      const queryParams = currentNavigation?.extractedUrl?.queryParams || {};

      // Preserve query params when redirecting as it is likely that the refreshed component
      // will be consuming the same query params.
      return router.createUrlTree([redirectUrl], { queryParams });
    } else {
      return true;
    }
  };
}
