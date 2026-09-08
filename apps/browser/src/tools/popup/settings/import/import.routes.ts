import { Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { KEEPER_SSO_TAB_MONITOR } from "@bitwarden/importer-ui";

// Type-only, so this does not create a runtime cycle back to the routing module.
import type { RouteDataProperties } from "../../../../popup/app-routing.module";
import { filePickerPopoutGuard } from "../../guards/file-picker-popout.guard";

import { BrowserKeeperSsoTabMonitor } from "./browser-keeper-sso-tab-monitor";
import { ImportBrowserV2Component } from "./import-browser-v2.component";

/**
 * Routes for the import screen, kept in their own lazily loaded file.
 *
 * `KEEPER_SSO_TAB_MONITOR` used to be provided by `AppModule`, which meant `AppModule` imported
 * `@bitwarden/importer-ui` for the token alone. That barrel re-exports `ImportComponent`, so the
 * entire importer -- every third-party CSV/JSON importer, plus jszip and papaparse -- was pulled
 * into the popup's startup bundle just to register one provider. Route `providers` are evaluated
 * when the route config is built, so declaring it here rather than in `app-routing.module.ts` is
 * what actually keeps the import off the critical path.
 *
 * The token is only injected by `KeeperDirectImportUiService`, which lives inside
 * `ImportComponent`'s provider scope, so a route-level provider is close enough to reach it.
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
