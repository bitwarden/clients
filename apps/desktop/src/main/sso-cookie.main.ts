import { Session } from "electron";
import { concatMap } from "rxjs/operators";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SERVER_COMMUNICATION_CONFIGS } from "@bitwarden/common/platform/services/server-communication-config/server-communication-config.state";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

export class SsoCookieMain {
  private activeDomains = new Set<string>();
  private session: Session | undefined;

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private logService: LogService,
  ) {}

  init(session: Session): void {
    this.session = session;

    const configs$ = this.globalStateProvider.get(SERVER_COMMUNICATION_CONFIGS).state$;

    configs$
      .pipe(
        concatMap(async (configs) => {
          await this.clearSessionCookies();

          if (!configs) {
            return;
          }

          for (const domain in configs) {
            const config = configs[domain];
            if (config.bootstrap.type !== "ssoCookieVendor") {
              continue;
            }

            const { cookieValue } = config.bootstrap;
            if (!Array.isArray(cookieValue) || cookieValue.length === 0) {
              continue;
            }

            await this.setSessionCookies(domain, cookieValue);
          }
        }),
      )
      .subscribe();
  }

  private async clearSessionCookies(): Promise<void> {
    for (const domain of this.activeDomains) {
      const cookies = await this.session!.cookies.get({ domain });
      for (const cookie of cookies) {
        await this.session!.cookies.remove(`https://${domain}`, cookie.name);
      }
    }
    this.activeDomains.clear();
  }

  private async setSessionCookies(
    domain: string,
    cookies: Array<{ name: string; value: string }>,
  ): Promise<void> {
    for (const { name, value } of cookies) {
      try {
        await this.session!.cookies.set({
          url: `https://${domain}`,
          name,
          value,
          domain,
          path: "/",
          sameSite: "no_restriction",
          secure: true,
        });
        this.activeDomains.add(domain);
      } catch (e) {
        this.logService.error(`SsoCookieMain: failed to set cookie "${name}" for ${domain}`, e);
      }
    }
  }
}
