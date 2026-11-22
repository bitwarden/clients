import { Observable, of } from "rxjs";

import { AngularThemingService } from "@bitwarden/angular/platform/services/theming/angular-theming.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";

export function createBrowserSystemThemeObservable(
  platformUtilsService: PlatformUtilsService,
  win: Window = window,
): Observable<Theme> {
  // Safari doesn't properly handle the (prefers-color-scheme) media query in the popup window, it always returns light.
  // This means we have to use the background page instead, which comes with limitations like not dynamically
  // changing the extension theme when the system theme is changed. We also have issues with memory leaks when
  // holding the reference to the background page.
  const backgroundWindow = BrowserApi.getBackgroundPage();
  if (platformUtilsService.isSafari() && backgroundWindow) {
    return of(AngularThemingService.getSystemThemeFromWindow(backgroundWindow));
  }

  // Chromium spanning-mode popouts open in the non-incognito profile and inherit its color scheme
  // rather than the incognito window's forced dark UI.
  if (platformUtilsService.isChromium() && BrowserPopupUtils.inIncognitoPopout(win)) {
    return of(ThemeTypes.Dark);
  }

  return AngularThemingService.createSystemThemeFromWindow(win);
}
