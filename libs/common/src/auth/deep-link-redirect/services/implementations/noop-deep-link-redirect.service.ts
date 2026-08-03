import { DeepLinkRedirectService } from "../deep-link-redirect.service";

/**
 * Default implementation for platforms without a deep-link route guard (browser extension,
 * desktop, CLI). The persist call is a silent drop so callers stay platform-agnostic.
 */
export class NoopDeepLinkRedirectService implements DeepLinkRedirectService {
  async persistPostLoginRedirectUrl(_url: string): Promise<void> {
    return;
  }
}
