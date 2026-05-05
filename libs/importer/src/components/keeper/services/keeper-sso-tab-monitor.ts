import { InjectionToken, inject } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export interface KeeperSsoTabMonitor {
  launchAndWaitForToken(ssoUrl: string, callbackUrlPattern: RegExp): Promise<string>;
  cancel(): void;
}

class DefaultKeeperSsoTabMonitor implements KeeperSsoTabMonitor {
  constructor(private readonly platformUtilsService: PlatformUtilsService) {}

  launchAndWaitForToken(ssoUrl: string): Promise<string> {
    this.platformUtilsService.launchUri(ssoUrl);
    return new Promise<string>(() => {});
  }

  cancel(): void {}
}

export const KEEPER_SSO_TAB_MONITOR = new InjectionToken<KeeperSsoTabMonitor>(
  "KEEPER_SSO_TAB_MONITOR",
  {
    providedIn: "root",
    factory: () => new DefaultKeeperSsoTabMonitor(inject(PlatformUtilsService)),
  },
);
