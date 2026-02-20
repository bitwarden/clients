import {
  computed,
  DestroyRef,
  EventEmitter,
  Injectable,
  NgZone,
  Signal,
  signal,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Event, Navigation, NavigationEnd, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { RouterFocusManagerService } from "./router-focus-manager.service";

describe("RouterFocusManagerService", () => {
  @Injectable()
  class MockNgZone extends NgZone {
    onStable: EventEmitter<any> = new EventEmitter(false);
    constructor() {
      super({ enableLongStackTrace: false });
    }
    run(fn: any): any {
      return fn();
    }
    runOutsideAngular(fn: any): any {
      return fn();
    }
    simulateZoneExit(): void {
      this.onStable.emit(null);
    }

    isStable: boolean = true;
  }

  @Injectable()
  class MockRouter extends Router {
    readonly currentNavigationExtras = signal({});

    readonly currentNavigation: Signal<Navigation> = computed(() => ({
      ...mock<Navigation>(),
      extras: this.currentNavigationExtras(),
    }));

    // eslint-disable-next-line rxjs/no-exposed-subjects
    readonly routerEventsSubject = new Subject<Event>();

    override get events() {
      return this.routerEventsSubject.asObservable();
    }
  }

  let service: RouterFocusManagerService;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let mockRouter: MockRouter;
  let mockConfigService: Partial<ConfigService>;
  let mockNgZoneRef: MockNgZone;

  let querySelectorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock ConfigService
    featureFlagSubject = new BehaviorSubject<boolean>(true);
    mockConfigService = {
      getFeatureFlag$: jest.fn((flag: FeatureFlag) => {
        if (flag === FeatureFlag.RouterFocusManagement) {
          return featureFlagSubject.asObservable();
        }
        return new BehaviorSubject(false).asObservable();
      }) as ConfigService["getFeatureFlag$"],
    };

    // Spy on document.querySelector and console.warn
    querySelectorSpy = jest.spyOn(document, "querySelector");
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    TestBed.configureTestingModule({
      providers: [
        RouterFocusManagerService,
        { provide: Router, useClass: MockRouter },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NgZone, useClass: MockNgZone },
        { provide: DestroyRef, useValue: { onDestroy: jest.fn() } },
      ],
    });

    service = TestBed.inject(RouterFocusManagerService);
    mockNgZoneRef = TestBed.inject(NgZone) as MockNgZone;
    mockRouter = TestBed.inject(Router) as MockRouter;
  });

  afterEach(() => {
    querySelectorSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    mockNgZoneRef.isStable = true;
    TestBed.resetTestingModule();
  });

  describe("default behavior", () => {
    it("should focus main element after navigation", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation (should trigger focus)
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).toHaveBeenCalledWith("main");
      expect(mainElement.focus).toHaveBeenCalled();
    });
  });

  describe("custom selector", () => {
    it("should focus custom element when focusAfterNav selector is provided", () => {
      const customElement = document.createElement("button");
      customElement.id = "custom-btn";
      customElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(customElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation with custom selector
      mockRouter.currentNavigationExtras.set({ state: { focusAfterNav: "#custom-btn" } });
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).toHaveBeenCalledWith("#custom-btn");
      expect(customElement.focus).toHaveBeenCalled();
    });
  });

  describe("opt-out", () => {
    it("should not focus when focusAfterNav is false", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation with opt-out
      mockRouter.currentNavigationExtras.set({ state: { focusAfterNav: false } });
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).not.toHaveBeenCalled();
      expect(mainElement.focus).not.toHaveBeenCalled();
    });
  });

  describe("element not found", () => {
    it("should log warning when custom selector does not match any element", () => {
      querySelectorSpy.mockReturnValue(null);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation with non-existent selector
      mockRouter.currentNavigationExtras.set({ state: { focusAfterNav: "#non-existent" } });
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).toHaveBeenCalledWith("#non-existent");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'RouterFocusManager: Could not find element with selector "#non-existent"',
      );
    });
  });

  // Remove describe block when FeatureFlag.RouterFocusManagement is removed
  describe("feature flag", () => {
    it("should not activate when RouterFocusManagement flag is disabled", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Disable feature flag
      featureFlagSubject.next(false);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation with flag disabled
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).not.toHaveBeenCalled();
      expect(mainElement.focus).not.toHaveBeenCalled();
    });

    it("should activate when RouterFocusManagement flag is enabled", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Ensure feature flag is enabled
      featureFlagSubject.next(true);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation with flag enabled
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(querySelectorSpy).toHaveBeenCalledWith("main");
      expect(mainElement.focus).toHaveBeenCalled();
    });
  });

  describe("first navigation skip", () => {
    it("should not trigger focus management on first navigation after page load", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      expect(querySelectorSpy).not.toHaveBeenCalled();
      expect(mainElement.focus).not.toHaveBeenCalled();
    });

    it("should trigger focus management on second and subsequent navigations", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation (should trigger focus)
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/second", "/second"));

      expect(querySelectorSpy).toHaveBeenCalledWith("main");
      expect(mainElement.focus).toHaveBeenCalledTimes(1);

      // Emit third navigation (should also trigger focus)
      mainElement.focus = jest.fn(); // Reset mock
      mockRouter.routerEventsSubject.next(new NavigationEnd(3, "/third", "/third"));

      expect(mainElement.focus).toHaveBeenCalledTimes(1);
    });
  });

  describe("NgZone stability", () => {
    it("should focus immediately when zone is stable", () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      expect(mainElement.focus).toHaveBeenCalled();
    });

    it("should wait for zone stability before focusing when zone is not stable", async () => {
      const mainElement = document.createElement("main");
      mainElement.focus = jest.fn();
      querySelectorSpy.mockReturnValue(mainElement);

      // Set zone as not stable
      mockNgZoneRef.isStable = false;

      // Subscribe to start the service
      service.start$.subscribe();

      // Emit first navigation (should be skipped)
      mockRouter.routerEventsSubject.next(new NavigationEnd(1, "/first", "/first"));

      // Emit second navigation
      mockRouter.routerEventsSubject.next(new NavigationEnd(2, "/test", "/test"));

      // Focus should not happen yet
      expect(mainElement.focus).not.toHaveBeenCalled();

      // Emit zone stability
      mockNgZoneRef.onStable.emit(true);

      // flush promises
      await Promise.resolve();

      // Now focus should have happened
      expect(mainElement.focus).toHaveBeenCalled();
    });
  });
});
