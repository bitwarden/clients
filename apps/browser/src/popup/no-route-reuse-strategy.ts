import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy } from "@angular/router";

import { ImportShellBrowserComponent } from "../tools/popup/settings/import/import-shell-browser.component";

@Injectable()
export class NoRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(route: ActivatedRouteSnapshot) {
    return false;
  }

  // eslint-disable-next-line
  store(route: ActivatedRouteSnapshot, handle: {}) {
    /* Nothing */
  }

  shouldAttach(route: ActivatedRouteSnapshot) {
    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): any {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot) {
    if (future.routeConfig !== curr.routeConfig) {
      return false;
    }
    // Root's routeConfig is always null; narrow reuse to both sides being the import shell so its
    // cached ActivatedRoute/queryParams don't leak into unrelated navigations.
    if (future.routeConfig === null) {
      return (
        future.firstChild?.routeConfig?.component === ImportShellBrowserComponent &&
        curr.firstChild?.routeConfig?.component === ImportShellBrowserComponent
      );
    }
    // Exception for the import shell: reused so its progress bar persists (and can animate) across
    // its own child routes.
    return future.routeConfig.component === ImportShellBrowserComponent;
  }
}
