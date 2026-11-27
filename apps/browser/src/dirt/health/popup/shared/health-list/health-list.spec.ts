import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  createEnvironmentInjector,
  ElementRef,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
  signal,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { SignalCacheOptions, ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { CompactModeService, ScrollLayoutService } from "@bitwarden/components";

import {
  announceHealthListCount,
  focusHealthListRow,
  HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS,
  HEALTH_LIST_ROW_ATTRIBUTE,
  HEALTH_LIST_ROW_HEIGHT,
  injectHealthListRowHeight,
  injectHealthListViewState,
  rememberHealthListScroll,
} from "./index";

describe("Health list helpers", () => {
  let compact$: BehaviorSubject<boolean>;
  let scrollLayout: ScrollLayoutService;
  let liveAnnouncer: { announce: jest.Mock; clear: jest.Mock };
  let viewCache: { signal: jest.Mock };

  beforeEach(() => {
    compact$ = new BehaviorSubject(false);
    liveAnnouncer = { announce: jest.fn().mockResolvedValue(undefined), clear: jest.fn() };
    // Stands in for the popup cache: hands back a plain signal seeded with the initial value.
    viewCache = {
      signal: jest.fn((options: SignalCacheOptions<unknown>) => signal(options.initialValue)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: CompactModeService, useValue: { enabled$: compact$ } },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: ViewCacheService, useValue: viewCache },
      ],
    });
    scrollLayout = TestBed.inject(ScrollLayoutService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function inContext<T>(fn: () => T): T {
    return runInInjectionContext(TestBed.inject(Injector), fn);
  }

  describe("injectHealthListRowHeight", () => {
    it.each([2, 3] as const)("follows compact mode for %i-line rows", (lines) => {
      const height = inContext(() => injectHealthListRowHeight(lines));
      expect(height()).toBe(HEALTH_LIST_ROW_HEIGHT[lines].default);

      compact$.next(true);
      expect(height()).toBe(HEALTH_LIST_ROW_HEIGHT[lines].compact);
    });

    it("keeps two-line rows at the popup vault's heights", () => {
      expect(HEALTH_LIST_ROW_HEIGHT[2]).toEqual({ default: 60, compact: 53 });
    });
  });

  describe("injectHealthListViewState", () => {
    it("keeps filters, sort and scroll under the list's key, across navigation", () => {
      const state = inContext(() =>
        injectHealthListViewState<{ search: string }, "name">("health-test", {
          filters: { search: "" },
          sort: "name",
        }),
      );

      expect(state.filters()).toEqual({ search: "" });
      expect(state.sort()).toBe("name");
      expect(state.scrollTop()).toBe(0);
      const options = viewCache.signal.mock.calls.map(([o]) => o as SignalCacheOptions<unknown>);
      expect(options.map((o) => o.key)).toEqual([
        "health-test-filters",
        "health-test-sort",
        "health-test-scroll",
      ]);
      expect(options.every((o) => o.persistNavigation)).toBe(true);
    });
  });

  describe("rememberHealthListScroll", () => {
    function scrollElement(): HTMLElement {
      const element = document.createElement("div");
      element.scrollTo = jest.fn() as never;
      return element;
    }

    it("restores the offset once the list is ready, not before", () => {
      jest.useFakeTimers();
      const scrollTop = signal(240);
      const ready = signal(false);
      const element = scrollElement();
      inContext(() => rememberHealthListScroll(scrollTop, ready));

      scrollLayout.scrollableRef.set(new ElementRef(element));
      TestBed.tick();
      jest.runAllTimers();
      expect(element.scrollTo).not.toHaveBeenCalled();

      ready.set(true);
      TestBed.tick();
      jest.runAllTimers();
      expect(element.scrollTo).toHaveBeenCalledWith({ top: 240, behavior: "instant" });
    });

    it("records the offset as the user scrolls", () => {
      jest.useFakeTimers();
      const scrollTop = signal(0);
      const element = scrollElement();
      inContext(() => rememberHealthListScroll(scrollTop, signal(true)));
      scrollLayout.scrollableRef.set(new ElementRef(element));
      TestBed.tick();

      element.scrollTop = 180;
      element.dispatchEvent(new Event("scroll"));
      jest.advanceTimersByTime(200);

      expect(scrollTop()).toBe(180);
      expect(element.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("announceHealthListCount", () => {
    it("announces a settled change politely, skipping the first count", () => {
      jest.useFakeTimers();
      const count = signal<number | undefined>(undefined);
      inContext(() => announceHealthListCount(count, (n) => `${n} groups`));

      count.set(12);
      TestBed.tick();
      count.set(3);
      TestBed.tick();
      count.set(2);
      TestBed.tick();
      jest.advanceTimersByTime(HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS);

      expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);
      expect(liveAnnouncer.announce).toHaveBeenCalledWith("2 groups", "polite");
    });

    it("clears the live region when the list goes away", () => {
      const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      runInInjectionContext(injector, () => announceHealthListCount(signal(3), (n) => `${n}`));

      injector.destroy();

      expect(liveAnnouncer.clear).toHaveBeenCalled();
    });

    it("stays quiet when the count does not change", () => {
      jest.useFakeTimers();
      const count = signal<number | undefined>(5);
      inContext(() => announceHealthListCount(count, (n) => `${n}`));
      TestBed.tick();

      count.set(5);
      TestBed.tick();
      jest.advanceTimersByTime(HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS);

      expect(liveAnnouncer.announce).not.toHaveBeenCalled();
    });
  });

  describe("focusHealthListRow", () => {
    function list(...ids: string[]): HTMLElement {
      const host = document.createElement("div");
      for (const id of ids) {
        const button = document.createElement("button");
        button.setAttribute(HEALTH_LIST_ROW_ATTRIBUTE, id);
        host.appendChild(button);
      }
      document.body.appendChild(host);
      return host;
    }

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("focuses the first preferred row that is rendered", () => {
      const host = list("a", "c");

      expect(focusHealthListRow(host, ["b", "c", "a"])).toBe(true);
      expect(document.activeElement?.getAttribute(HEALTH_LIST_ROW_ATTRIBUTE)).toBe("c");
    });

    it("falls back when no preferred row is rendered", () => {
      const host = list("a");
      const heading = document.createElement("h2");
      heading.tabIndex = -1;
      document.body.appendChild(heading);

      expect(focusHealthListRow(host, ["z", undefined], () => heading)).toBe(false);
      expect(document.activeElement).toBe(heading);
    });
  });
});
