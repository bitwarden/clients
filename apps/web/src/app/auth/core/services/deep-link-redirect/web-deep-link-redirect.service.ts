import { DeepLinkRedirectService } from "@bitwarden/common/auth/deep-link-redirect";

import { RouterService } from "../../../../core/router.service";

/**
 * Web implementation of {@link DeepLinkRedirectService}. Delegates to
 * `RouterService.persistLoginRedirectUrl`, which owns the `sessionStorage` key the
 * deep-link route guard reads and clears after auth completes.
 */
export class WebDeepLinkRedirectService implements DeepLinkRedirectService {
  constructor(private readonly routerService: RouterService) {}

  persistPostLoginRedirectUrl(url: string): Promise<void> {
    return this.routerService.persistLoginRedirectUrl(url);
  }
}
