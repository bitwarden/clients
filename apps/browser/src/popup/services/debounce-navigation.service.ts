// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable, OnDestroy } from "@angular/core";
import { CanActivateFn, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { filter, pairwise } from "rxjs/operators";

/**
 * CanActivate guard that cancels duplicate navigation events, which can otherwise reinitialize some components
 * unexpectedly.
 * Specifically, this is used to avoid data loss when navigating from the password generator component back to the
 * add/edit cipher component in browser.
 * For more information, see https://github.com/bitwarden/clients/pull/1935
 */
export function debounceNavigationGuard(): CanActivateFn {
  return async () => {
    const debounceNavigationService = inject(DebounceNavigationService);
    return debounceNavigationService.canActivate();
  };
}

@Injectable()
export class DebounceNavigationService implements OnDestroy {
  navigationStartSub: Subscription;
  navigationSuccessSub: Subscription;

  private lastNavigation: NavigationStart;
  private thisNavigation: NavigationStart;
  private lastNavigationSuccessId: number;

  constructor(private router: Router) {
    this.navigationStartSub = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        pairwise(),
      )
      .subscribe(
        (events: [NavigationStart, NavigationStart]) =>
          ([this.lastNavigation, this.thisNavigation] = events),
      );

    this.navigationSuccessSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => (this.lastNavigationSuccessId = event.id));
  }

  async canActivate() {
    return !(
      this.thisNavigation?.navigationTrigger === "hashchange" &&
      this.lastNavigation.navigationTrigger === "popstate" &&
      this.lastNavigationSuccessId === this.lastNavigation.id &&
      this.lastNavigation.url === this.thisNavigation?.url
    );
  }

  ngOnDestroy() {
    if (this.navigationStartSub != null) {
      this.navigationStartSub.unsubscribe();
    }

    if (this.navigationSuccessSub != null) {
      this.navigationSuccessSub.unsubscribe();
    }
  }
}
