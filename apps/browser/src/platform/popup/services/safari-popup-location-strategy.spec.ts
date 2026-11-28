import {
  Location,
  LocationChangeListener,
  LocationStrategy,
  PlatformLocation,
} from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { NavigationEnd, provideRouter, Router } from "@angular/router";
import { filter, firstValueFrom } from "rxjs";

import { BrowserApi } from "../../browser/browser-api";
import BrowserPopupUtils from "../../browser/browser-popup-utils";

import {
  needsSafariPopupLocationStrategy,
  SafariPopupLocationStrategy,
} from "./safari-popup-location-strategy";

/** Mimics a browser's session history for one window. */
class FakePlatformLocation extends PlatformLocation {
  readonly entries: { state: unknown; url: string }[] = [{ state: null, url: "" }];
  readonly historyGoCalls: number[] = [];
  private index = 0;
  private readonly popStateListeners: LocationChangeListener[] = [];

  get hash(): string {
    const url = this.entries[this.index].url;
    const hashStart = url.indexOf("#");
    return hashStart === -1 ? "" : url.substring(hashStart);
  }
  get href(): string {
    return "";
  }
  get protocol(): string {
    return "safari-web-extension:";
  }
  get hostname(): string {
    return "";
  }
  get port(): string {
    return "";
  }
  get pathname(): string {
    return "/popup/index.html";
  }
  get search(): string {
    return "";
  }

  getBaseHrefFromDOM(): string {
    return "";
  }

  getState(): unknown {
    return this.entries[this.index].state;
  }

  onPopState(fn: LocationChangeListener): VoidFunction {
    this.popStateListeners.push(fn);
    return () => this.popStateListeners.splice(this.popStateListeners.indexOf(fn), 1);
  }

  onHashChange(): VoidFunction {
    return () => {};
  }

  pushState(state: unknown, _title: string, url: string): void {
    this.entries.splice(this.index + 1);
    this.entries.push({ state, url });
    this.index++;
  }

  replaceState(state: unknown, _title: string, url: string): void {
    this.entries[this.index] = { state, url };
  }

  historyGo(relativePosition: number): void {
    this.historyGoCalls.push(relativePosition);
    const target = this.index + relativePosition;
    if (target < 0 || target >= this.entries.length) {
      return;
    }
    this.index = target;
    for (const listener of this.popStateListeners) {
      listener({ type: "popstate", state: this.getState() });
    }
  }

  back(): void {
    this.historyGo(-1);
  }

  forward(): void {
    this.historyGo(1);
  }
}

describe("SafariPopupLocationStrategy", () => {
  let platformLocation: FakePlatformLocation;
  let strategy: SafariPopupLocationStrategy;

  beforeEach(() => {
    platformLocation = new FakePlatformLocation();
    strategy = new SafariPopupLocationStrategy(platformLocation);
  });

  it("keeps the browser history at one entry across navigations", () => {
    strategy.pushState({ id: 1 }, "", "/tabs/vault", "");
    strategy.pushState({ id: 2 }, "", "/view-cipher", "cipherId=1");

    expect(platformLocation.entries).toHaveLength(1);
    expect(strategy.path(true)).toBe("/view-cipher?cipherId=1");
    expect(strategy.getState()).toEqual({ id: 2 });
  });

  it("returns to the previous page and its state on back", () => {
    const listener = jest.fn();
    strategy.onPopState(listener);
    strategy.pushState({ id: 1 }, "", "/tabs/vault", "");
    strategy.pushState({ id: 2 }, "", "/view-cipher", "");

    strategy.back();

    expect(strategy.path(true)).toBe("/tabs/vault");
    expect(strategy.getState()).toEqual({ id: 1 });
    expect(listener).toHaveBeenCalledWith({ type: "popstate", state: { id: 1 } });
    expect(platformLocation.entries).toHaveLength(1);
  });

  it("steps back several pages with historyGo", () => {
    strategy.pushState({ id: 1 }, "", "/tabs/vault", "");
    strategy.pushState({ id: 2 }, "", "/view-cipher", "");
    strategy.pushState({ id: 3 }, "", "/edit-cipher", "");

    strategy.historyGo(-2);
    expect(strategy.path(true)).toBe("/tabs/vault");

    strategy.back();
    expect(strategy.path(true)).toBe("");
  });

  it("leaves back to the browser when it has no recorded page", () => {
    strategy.back();

    expect(platformLocation.historyGoCalls).toEqual([-1]);
  });

  it("leaves forward and out-of-range steps to the browser", () => {
    strategy.pushState({ id: 1 }, "", "/tabs/vault", "");

    strategy.historyGo(1);
    strategy.historyGo(-2);

    expect(platformLocation.historyGoCalls).toEqual([1, -2]);
    expect(strategy.path(true)).toBe("/tabs/vault");
  });

  it("stops notifying listeners after it is destroyed", () => {
    const listener = jest.fn();
    strategy.onPopState(listener);
    strategy.pushState({ id: 1 }, "", "/tabs/vault", "");

    strategy.ngOnDestroy();
    strategy.back();

    expect(listener).not.toHaveBeenCalled();
  });

  describe("with the Angular router", () => {
    @Component({ template: "", changeDetection: ChangeDetectionStrategy.OnPush })
    class EmptyComponent {}

    let router: Router;
    let location: Location;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            { path: "", component: EmptyComponent },
            { path: "tabs/vault", component: EmptyComponent },
            { path: "view-cipher", component: EmptyComponent },
          ]),
          { provide: PlatformLocation, useValue: platformLocation },
          { provide: LocationStrategy, useClass: SafariPopupLocationStrategy },
        ],
      });
      router = TestBed.inject(Router);
      location = TestBed.inject(Location);
      // Starts the router's popstate listener, as the popup does on startup.
      router.initialNavigation();
    });

    it("navigates back without growing the browser history", async () => {
      await router.navigateByUrl("/tabs/vault");
      await router.navigateByUrl("/view-cipher");
      expect(platformLocation.entries).toHaveLength(1);

      const navigatedBack = firstValueFrom(
        router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      );
      location.back();
      await navigatedBack;

      expect(router.url).toBe("/tabs/vault");
      expect(platformLocation.entries).toHaveLength(1);
    });
  });
});

describe("needsSafariPopupLocationStrategy", () => {
  const originalIsSafariApi = BrowserApi.isSafariApi;

  afterEach(() => {
    BrowserApi.isSafariApi = originalIsSafariApi;
    jest.restoreAllMocks();
  });

  it.each([
    { isSafariApi: true, inPopup: true, expected: true },
    { isSafariApi: true, inPopup: false, expected: false },
    { isSafariApi: false, inPopup: true, expected: false },
  ])(
    "is $expected when isSafariApi is $isSafariApi and inPopup is $inPopup",
    ({ isSafariApi, inPopup, expected }) => {
      BrowserApi.isSafariApi = isSafariApi;
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(inPopup);

      expect(needsSafariPopupLocationStrategy(window)).toBe(expected);
    },
  );
});
