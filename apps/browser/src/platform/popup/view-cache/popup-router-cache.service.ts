// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Location } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  NavigationEnd,
  Router,
  UrlSerializer,
  UrlTree,
} from "@angular/router";
import { filter, first, firstValueFrom, map, Observable, of, switchMap, tap } from "rxjs";

import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import { POPUP_ROUTE_HISTORY_KEY } from "../../../platform/services/popup-view-cache-background.service";
import BrowserPopupUtils from "../../browser/browser-popup-utils";

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

  private hasNavigated = false;

  private _hasRestoredCache = false;
  get hasRestoredCache() {
    return this._hasRestoredCache;
  }

  constructor() {
    // init history with existing state
    this.history$()
      .pipe(first())
      .subscribe(
        (history) =>
          Array.isArray(history) && history.forEach((location) => this.location.go(location)),
      );

    // update state when route change occurs
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        tap(() => {
          // `Location.back()` can now be called successfully
          this.hasNavigated = true;
        }),
        filter((_event: NavigationEnd) => {
          const state: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;

          let child = state.firstChild;
          while (child.firstChild) {
            child = child.firstChild;
          }

          return !child?.data?.doNotSaveUrl;
        }),
        switchMap((event) => this.push(event.url)),
      )
      .subscribe();
  }

  history$(): Observable<string[]> {
    return this.state.state$;
  }

  async setHistory(state: string[]): Promise<string[]> {
    return this.state.update(() => state);
  }

  /** Get the last item from the history stack, or `null` if empty */
  last$(): Observable<string | null> {
    return this.history$().pipe(
      map((history) => {
        if (!history || history.length === 0) {
          return null;
        }
        return history[history.length - 1];
      }),
    );
  }

  /**
   * If in browser popup, push new route onto history stack
   */
  private async push(url: string) {
    if (!BrowserPopupUtils.inPopup(window) || url === (await firstValueFrom(this.last$()))) {
      return;
    }
    await this.state.update((prevState) => (prevState == null ? [url] : prevState.concat(url)));
  }

  /**
   * Navigate back in history
   */
  async back() {
    if (!BrowserPopupUtils.inPopup(window)) {
      this.location.back();
      return;
    }

    const history = await this.state.update((prevState) =>
      prevState ? prevState.slice(0, -1) : [],
    );

    if (this.hasNavigated && history.length) {
      this.location.back();
      return;
    }

    // if no history is present, fallback to vault page
    await this.router.navigate([""]);
  }

  /**
   * Mark the cache as restored to prevent the router `popupRouterCacheGuard` from
   * redirecting to the last visited route again this session.
   */
  markCacheRestored() {
    this._hasRestoredCache = true;
  }
}

/**
 * Redirect to the last visited route. Should be applied to root route.
 **/
export const popupRouterCacheGuard = ((): Observable<true | UrlTree> => {
  const popupHistoryService = inject(PopupRouterCacheService);
  const urlSerializer = inject(UrlSerializer);

  if (popupHistoryService.hasRestoredCache) {
    return of(true);
  }

  return popupHistoryService.last$().pipe(
    map((url: string) => {
      if (!url) {
        return true;
      }

      popupHistoryService.markCacheRestored();
      return urlSerializer.parse(url);
    }),
  );
}) satisfies CanActivateFn;
