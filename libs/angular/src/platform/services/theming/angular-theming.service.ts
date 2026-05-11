import { Inject, Injectable } from "@angular/core";
import {
  combineLatest,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  Subscription,
  switchMap,
} from "rxjs";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { AccentColorStateService } from "@bitwarden/common/platform/theming/accent-color-state.service";
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

      if (configuredTheme === ThemeTypes.Oled) {
        return of(ThemeTypes.Oled);
      }

      return of(configuredTheme);
    }),
  );

  constructor(
    private themeStateService: ThemeStateService,
    private accentColorStateService: AccentColorStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE)
    private systemTheme$: Observable<Theme>,
  ) {}

  applyThemeChangesTo(document: Document): Subscription {
    const root = document.documentElement;

    return combineLatest([this.theme$, this.accentColorStateService.accentColorHex$]).subscribe(
      ([theme, accentHex]) => {
        root.classList.remove(
          "theme_" + ThemeTypes.Light,
          "theme_" + ThemeTypes.Dark,
          "theme_" + ThemeTypes.Oled,
        );
        if (theme === ThemeTypes.Oled) {
          root.classList.add("theme_" + ThemeTypes.Dark, "theme_" + ThemeTypes.Oled);
        } else {
          root.classList.add("theme_" + theme);
        }

        const rgbTriplet =
          accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex)
            ? AngularThemingService.hexToRgbTriplet(accentHex)
            : null;
        root.classList.toggle("fork-accent-override", !!rgbTriplet);
        if (rgbTriplet) {
          root.style.setProperty("--fork-accent-rgb", rgbTriplet);
        } else {
          root.style.removeProperty("--fork-accent-rgb");
        }
      },
    );
  }

  private static hexToRgbTriplet(hex: string): string {
    const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex.trim());
    if (!m) {
      return "";
    }
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `${r} ${g} ${b}`;
  }
}
