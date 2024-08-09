import { Location } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  NavigationEnd,
  Router,
  UrlSerializer,
} from "@angular/router";
import { filter, firstValueFrom, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import { POPUP_ROUTE_HISTORY_KEY } from "../../../platform/services/popup-view-cache-background.service";

/**
 * Preserves route history when opening and closing the popup
 *
 * Routes marked with `doNotSaveUrl` will not be stored
 **/
@Injectable({
  providedIn: "root",
})
export class PopupRouterCacheService {
  private router = inject(Router);
  private state = inject(GlobalStateProvider).get(POPUP_ROUTE_HISTORY_KEY);
  private location = inject(Location);

  constructor() {
    // init history with existing state
    void this.getHistory().then((history) =>
      history.forEach((location) => this.location.go(location)),
    );

    // update state when route change occurs
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        filter((_event: NavigationEnd) => {
          const state: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;

          let child = state.firstChild;
          while (child.firstChild) {
            child = child.firstChild;
          }

          return !child?.data?.doNotSaveUrl ?? true;
        }),
        switchMap((event) => this.push(event.url)),
      )
      .subscribe();
  }

  async getHistory(): Promise<string[]> {
    return firstValueFrom(this.state.state$);
  }

  async setHistory(state: string[]): Promise<string[]> {
    return this.state.update(() => state);
  }

  /** Get the last item from the history stack */
  async last(): Promise<string> {
    const history = await this.getHistory();
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1];
  }

  /**
   * If in browser popup, push new route onto history stack
   */
  private async push(url: string): Promise<boolean> {
    if (url === (await this.last())) {
      return false;
    }

    await this.state.update((prevState) => (prevState === null ? [url] : prevState.concat(url)));
  }

  /**
   * Navigate back in history
   */
  async back() {
    await this.state.update((prevState) => prevState.slice(0, -1));

    const url = this.router.url;
    this.location.back();
    if (url !== this.router.url) {
      return;
    }

    // if no history is present, fallback to vault page
    await this.router.navigate([""]);
  }
}

/**
 * Redirect to the last visited route. Should be applied to root route.
 *
 * If `FeatureFlag.PersistPopupView` is disabled, do nothing.
 **/
export const popupRouterCacheGuard = (async () => {
  const configService = inject(ConfigService);
  const popupHistoryService = inject(PopupRouterCacheService);
  const urlSerializer = inject(UrlSerializer);

  if (!(await configService.getFeatureFlag(FeatureFlag.PersistPopupView))) {
    return true;
  }

  const url = await popupHistoryService.last();

  if (!url) {
    return true;
  }

  return urlSerializer.parse(url);
}) satisfies CanActivateFn;
