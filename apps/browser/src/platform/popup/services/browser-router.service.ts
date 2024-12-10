// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class BrowserRouterService {
  private previousUrl?: string = undefined;

  constructor(router: Router) {
    router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const state: ActivatedRouteSnapshot = router.routerState.snapshot.root;

        let child = state.firstChild;
        while (child.firstChild) {
          child = child.firstChild;
        }

        const updateUrl = !child?.data?.doNotSaveUrl ?? true;

        if (updateUrl) {
          this.setPreviousUrl(event.url);
        }
      });
  }

  getPreviousUrl() {
    return this.previousUrl;
  }

  setPreviousUrl(url: string) {
    this.previousUrl = url;
  }
}
