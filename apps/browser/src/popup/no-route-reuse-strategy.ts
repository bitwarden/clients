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
    // Exception for the import shell: reused only when both snapshots are literally its own route
    // node, so its progress bar persists (and can animate) across its own child routes. No effect
    // on any other route in the app.
    return (
      future.routeConfig === curr.routeConfig &&
      future.routeConfig?.component === ImportShellBrowserComponent
    );
  }
}
