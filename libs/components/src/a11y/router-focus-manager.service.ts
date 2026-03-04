import { inject, Injectable, NgZone } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { skip, filter, combineLatestWith, tap, map, firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { queryForAutofocusDescendents } from "../input";

@Injectable({ providedIn: "root" })
export class RouterFocusManagerService {
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private configService = inject(ConfigService);

  /**
   * See associated router-focus-manager.mdx page for documentation on what this pipeline does and
   * how to customize focus behavior.
   */
  start$ = this.router.events.pipe(
    takeUntilDestroyed(),
    filter((navEvent) => navEvent instanceof NavigationEnd),
    /**
     * On first page load, we do not want to skip the user over the navigation content,
     * so we opt out of the default focus management behavior.
     */
    skip(1),
    combineLatestWith(this.configService.getFeatureFlag$(FeatureFlag.RouterFocusManagement)),
    filter(([_navEvent, flagEnabled]) => flagEnabled),
    map(() => {
      const currentNavExtras = this.router.currentNavigation()?.extras;

      const focusAfterNav: boolean | string | undefined = currentNavExtras?.state?.focusAfterNav;

      return focusAfterNav;
    }),
    filter((focusAfterNav) => {
      return focusAfterNav !== false;
    }),
    tap(async (focusAfterNav) => {
      let elSelector: string = "main";

      if (typeof focusAfterNav === "string" && focusAfterNav.length > 0) {
        elSelector = focusAfterNav;
      }

      if (this.ngZone.isStable) {
        this.focusTargetEl(elSelector);
      } else {
        await firstValueFrom(this.ngZone.onStable);

        this.focusTargetEl(elSelector);
      }
    }),
  );

  private focusTargetEl(elSelector: string) {
    const targetEl = document.querySelector<HTMLElement>(elSelector);
    const mainEl = document.querySelector<HTMLElement>("main");

    const pageHasAutofocusEl = mainEl && queryForAutofocusDescendents(mainEl).length > 0;

    if (pageHasAutofocusEl) {
      // do nothing because autofocus will handle the focus
      return;
    } else if (targetEl) {
      targetEl.focus();
    } else {
      // eslint-disable-next-line no-console
      console.warn(`RouterFocusManager: Could not find element with selector "${elSelector}"`);
    }
  }
}
