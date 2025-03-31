import { Observable, Subscription } from "rxjs";

import { Theme } from "@bitwarden/common/platform/enums";

/**
 * A service for managing and observing the current application theme.
 */
// FIXME: Rename to ThemingService
export abstract class AbstractThemingService {
  /**
   * The effective theme based on the user configured choice and the current system theme if
   * the configured choice is {@link ThemeTypes.System}.
   */
  abstract theme$: Observable<Theme>;
  /**
   * Listens for effective theme changes and applies changes to the provided document.
   * @param document The document that should have theme classes applied to it.
   *
   * @returns A subscription that can be unsubscribed from to cancel the application of theme classes.
   */
  abstract applyThemeChangesTo(document: Document): Subscription;
}
