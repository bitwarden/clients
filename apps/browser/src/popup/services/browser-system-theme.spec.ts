import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { BrowserApi } from "../../platform/browser/browser-api";

import { createBrowserSystemThemeObservable } from "./browser-system-theme";

function createMockWindow(href: string, prefersDark: boolean): Window {
  const mediaQueryList = {
    matches: prefersDark,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  } as unknown as MediaQueryList;

  return {
    location: { href },
    matchMedia: jest.fn().mockReturnValue(mediaQueryList),
  } as unknown as Window;
}

describe("createBrowserSystemThemeObservable", () => {
  beforeEach(() => {
    jest.spyOn(BrowserApi, "getBackgroundPage").mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("emits dark for a Chromium popout opened from incognito when matchMedia reports light", async () => {
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.isChromium.mockReturnValue(true);

    const win = createMockWindow(
      "chrome-extension://id/popup/index.html?uilocation=popout&incognito=true#/fido2",
      false,
    );

    const theme = await firstValueFrom(
      createBrowserSystemThemeObservable(platformUtilsService, win),
    );

    expect(theme).toBe(ThemeTypes.Dark);
    expect(win.matchMedia).not.toHaveBeenCalled();
  });

  it("follows matchMedia for a non-incognito Chromium popout", async () => {
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.isChromium.mockReturnValue(true);

    const win = createMockWindow(
      "chrome-extension://id/popup/index.html?uilocation=popout#/fido2",
      false,
    );

    const theme = await firstValueFrom(
      createBrowserSystemThemeObservable(platformUtilsService, win),
    );

    expect(theme).toBe(ThemeTypes.Light);
  });

  it("follows matchMedia for non-Chromium browsers even on an incognito popout URL", async () => {
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.isChromium.mockReturnValue(false);

    const win = createMockWindow(
      "moz-extension://id/popup/index.html?uilocation=popout&incognito=true#/fido2",
      false,
    );

    const theme = await firstValueFrom(
      createBrowserSystemThemeObservable(platformUtilsService, win),
    );

    expect(theme).toBe(ThemeTypes.Light);
  });

  it("reads the background page theme on Safari when available", async () => {
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(true);
    platformUtilsService.isChromium.mockReturnValue(false);

    const bgWin = createMockWindow("safari-web-extension://id/background.html", true);
    jest.spyOn(BrowserApi, "getBackgroundPage").mockReturnValue(bgWin);

    const win = createMockWindow("safari-web-extension://id/popup/index.html", false);

    const theme = await firstValueFrom(
      createBrowserSystemThemeObservable(platformUtilsService, win),
    );

    expect(theme).toBe(ThemeTypes.Dark);
  });
});
