import { Inject, Injectable } from "@angular/core";
import { fromEvent, map, merge, Observable, of, Subscription, switchMap } from "rxjs";

import { ThemeTypes, Theme } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { SYSTEM_THEME_OBSERVABLE } from "../../../services/injection-tokens";

import { AbstractThemingService } from "./theming.service.abstraction";

@Injectable()
export class AngularThemingService implements AbstractThemingService {
  /**
   * Creates a system theme observable based on watching the given window.
   * @param window The window that should be watched for system theme changes.
   * @returns An observable that will track the system theme.
   */
  static createSystemThemeFromWindow(window: Window): Observable<Theme> {
    return merge(
      // This observable should always emit at least once, so go and get the current system theme designation
      of(AngularThemingService.getSystemThemeFromWindow(window)),
      // Start listening to changes
      fromEvent<MediaQueryListEvent>(
        window.matchMedia("(prefers-color-scheme: dark)"),
        "change",
      ).pipe(map((event) => (event.matches ? ThemeTypes.Dark : ThemeTypes.Light))),
    );
  }

  /**
   * Gets the currently active system theme based on the given window.
   * @param window The window to query for the current theme.
   * @returns The active system theme.
   */
  static getSystemThemeFromWindow(window: Window): Theme {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeTypes.Dark
      : ThemeTypes.Light;
  }

  readonly theme$ = this.themeStateService.selectedTheme$.pipe(
    switchMap((configuredTheme) => {
      if (configuredTheme === ThemeTypes.System) {
        return this.systemTheme$;
      }

      return of(configuredTheme);
    }),
  );

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<Theme>,
  ) {}

  applyThemeChangesTo(document: Document): Subscription {
    return this.theme$.subscribe((theme) => {
      document.documentElement.classList.remove(
        "theme_" + ThemeTypes.Light,
        "theme_" + ThemeTypes.Dark,
      );
      document.documentElement.classList.add("theme_" + theme);
    });
  }
}
