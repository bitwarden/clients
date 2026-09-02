import { inject } from "@angular/core";
import { CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { All } from "@bitwarden/vault";

/**
 * Redirects the unfiltered Admin Console vault to `?sharedFolderId=all`, which renders the same
 * page, so the side nav's Shared folders entry has a URL to match.
 */
export const orgVaultDefaultFilterGuard: CanActivateFn = async (route) => {
  const params = route.queryParamMap;
  // Accept both param names during the shared-folder terminology transition.
  if (params.has("type") || params.has("sharedFolderId") || params.has("collectionId")) {
    return true;
  }

  const configService = inject(ConfigService);
  if (!(await configService.getFeatureFlag(FeatureFlag.VFO1Foundation))) {
    return true;
  }

  return createUrlTreeFromSnapshot(route, [], { ...route.queryParams, sharedFolderId: All });
};
