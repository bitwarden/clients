import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { skip, filter, combineLatestWith, tap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Injectable({ providedIn: "root" })
export class RouterFocusManagerService {
  private router = inject(Router);

  private configService = inject(ConfigService);

  /**
   * Handles SPA route focus management. SPA apps don't automatically notify screenreader
   * users that navigation has occured or move the user's focus to the content they are
   * navigating to, so we need to do it.
   *
   * By default, we focus the `main` after an internal route navigation.
   *
   * Consumers can opt out of the passing the following to the `state` input. Using `state`
   * allows us to access the value between browser back/forward arrows.
   * In template: `<a [routerLink]="route()" [state]="{ focusMainAfterNav: false }"></a>`
   * In typescript: `this.router.navigate([], { state: { focusMainAfterNav: false }})`
   *
   * Or, consumers can use the autofocus directive on an applicable interactive element.
   * The autofocus directive will take precedence over this route focus pipeline.
   *
   * Example of where you might want to manually opt out:
   * - Tab component causes a route navigation, but the tab content should be focused,
   * not the whole `main`
   *
   * Note that router events that cause a fully new page to load (like switching between
   * products) will not follow this pipeline. Instead, those will automatically bring
   * focus to the top of the html document as if it were a full page load. So those links
   * do not need to manually opt out of this pipeline.
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
    filter(() => {
      const currentNavExtras = this.router.currentNavigation()?.extras;

      const focusMainAfterNav: boolean | undefined = currentNavExtras?.state?.focusMainAfterNav;

      return focusMainAfterNav !== false;
    }),
    tap(() => {
      const mainEl = document.querySelector<HTMLElement>("main");

      if (mainEl) {
        mainEl.focus();
      }
    }),
  );
}
