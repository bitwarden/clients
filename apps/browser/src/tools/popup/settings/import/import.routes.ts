import { Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { KEEPER_SSO_TAB_MONITOR } from "@bitwarden/importer-ui";

// Type-only, so this does not create a runtime cycle back to the routing module.
import type { RouteDataProperties } from "../../../../popup/app-routing.module";
import { filePickerPopoutGuard } from "../../guards/file-picker-popout.guard";

import { BrowserKeeperSsoTabMonitor } from "./browser-keeper-sso-tab-monitor";
import { ImportBrowserV2Component } from "./import-browser-v2.component";

/**
 * Routes for the import screen, in their own lazily loaded file.
 *
 * Route `providers` are evaluated when the route config is built, so `KEEPER_SSO_TAB_MONITOR`
 * has to be declared here rather than in `app-routing.module.ts` -- otherwise registering it
 * pulls `@bitwarden/importer-ui`, and the `ImportComponent` it re-exports, onto the popup's
 * startup path. The token is only injected by `KeeperDirectImportUiService`, which lives inside
 * `ImportComponent`'s provider scope, so a route-level provider reaches it.
 */
export const importRoutes: Routes = [
  {
    path: "",
    component: ImportBrowserV2Component,
    canActivate: [authGuard, filePickerPopoutGuard()],
    providers: [{ provide: KEEPER_SSO_TAB_MONITOR, useClass: BrowserKeeperSsoTabMonitor }],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
];
