// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  KeyDefinition,
  ROUTER_DISK,
  StateProvider,
  GlobalState,
} from "@bitwarden/common/platform/state";

/**
 * Data properties acceptable for use in route objects (see usage in oss-routing.module.ts for example)
 */
export interface RouteDataProperties {
  /**
   * Title of the current HTML document (shows in browser tab)
   */
  titleId?: string;
  /**
   * doNotSaveUrl - choose to not keep track of the previous URL in memory in the RouterService
   */
  doNotSaveUrl?: boolean;
}

const DEEP_LINK_REDIRECT_URL = new KeyDefinition(ROUTER_DISK, "deepLinkRedirectUrl", {
  deserializer: (value: string) => value,
});

@Injectable()
export class RouterService {
  /**
   * The string value of the URL the user tried to navigate to while unauthenticated.
   *
   * Developed to allow users to deep link even when the navigation gets interrupted
   * by the authentication process.
   */
  private deepLinkRedirectUrlState: GlobalState<string>;

  private previousUrl: string = undefined;
  private currentUrl: string = undefined;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private titleService: Title,
    private stateProvider: StateProvider,
    i18nService: I18nService,
  ) {
    this.deepLinkRedirectUrlState = this.stateProvider.getGlobal(DEEP_LINK_REDIRECT_URL);

    this.currentUrl = this.router.url;

    router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.url;

        let title = i18nService.t("bitWebVault");

        if (this.currentUrl.includes("/sm/")) {
          title = i18nService.t("bitSecretsManager");
        }

        let child = this.activatedRoute.firstChild;
        while (child.firstChild) {
          child = child.firstChild;
        }

        const titleId: string = child?.snapshot?.data?.titleId;
        const rawTitle: string = child?.snapshot?.data?.title;

        // TODO: Eslint upgrade. Please resolve this since the ?? does nothing
        // eslint-disable-next-line no-constant-binary-expression
        const updateUrl = !child?.snapshot?.data?.doNotSaveUrl ?? true;

        if (titleId != null || rawTitle != null) {
          const newTitle = rawTitle != null ? rawTitle : i18nService.t(titleId);
          if (newTitle != null && newTitle !== "") {
            title = newTitle + " | " + title;
          }
        }
        this.titleService.setTitle(title);
        if (updateUrl) {
          this.setPreviousUrl(this.currentUrl);
        }
      });
  }

  getPreviousUrl(): string | undefined {
    return this.previousUrl;
  }

  setPreviousUrl(url: string): void {
    this.previousUrl = url;
  }

  /**
   * Save URL to Global State. This service is used during the login process
   * @param url URL being saved to the Global State
   */
  async persistLoginRedirectUrl(url: string): Promise<void> {
    await this.deepLinkRedirectUrlState.update(() => url);
  }

  /**
   * Fetch and clear persisted LoginRedirectUrl if present in state
   */
  async getAndClearLoginRedirectUrl(): Promise<string | undefined> {
    const persistedPreLoginUrl = await firstValueFrom(this.deepLinkRedirectUrlState.state$);

    if (!Utils.isNullOrEmpty(persistedPreLoginUrl)) {
      await this.persistLoginRedirectUrl(null);
      return persistedPreLoginUrl;
    }

    return;
  }
}
