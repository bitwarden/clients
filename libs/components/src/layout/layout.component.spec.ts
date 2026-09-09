import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { BehaviorSubject, Observable, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalState, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

import { NavigationModule } from "../navigation/navigation.module";
import { SIDE_NAV_WIDTH_BOUNDS } from "../navigation/side-nav-width.service";
import { SideNavService } from "../navigation/side-nav.service";
import { I18nMockService } from "../utils/i18n-mock.service";

import { LayoutComponent } from "./layout.component";

// JSDOM implements neither ResizeObserver nor layout, so these tests drive both by hand: the
// observer callback is captured and fired explicitly, and `clientWidth` is stubbed on the
// prototype. What they exercise is the push/overlay reconciliation logic, not measurement.
class ResizeObserverStub {
  static latest: ResizeObserverStub | undefined;

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.latest = this;
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  /** Fire the callback as the browser would after a layout change. */
  emit() {
    this.callback([], this as unknown as ResizeObserver);
  }
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/** A width state whose `state$` stays silent until `deliver` is called. */
class DeferredWidthState implements GlobalState<number> {
  private readonly _state$ = new BehaviorSubject<number | null>(undefined as unknown as null);

  get state$(): Observable<number | null> {
    // Skip the seed so nothing is emitted before `deliver`.
    return new Observable<number | null>((subscriber) => {
      const sub = this._state$.subscribe((value) => {
        if (value !== undefined) {
          subscriber.next(value);
        }
      });
      return () => sub.unsubscribe();
    });
  }

  deliver(width: number | null) {
    this._state$.next(width);
  }

  async update(configureState: (state: number | null, dependency: never) => number | null) {
    const next = configureState(this._state$.value, null as never);
    this._state$.next(next);
    return next;
  }
}

class DeferredStateProvider implements GlobalStateProvider {
  readonly width = new DeferredWidthState();

  get<T>(_keyDefinition: KeyDefinition<T>): GlobalState<T> {
    return this.width as unknown as GlobalState<T>;
  }
}

@Component({
  imports: [LayoutComponent, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bit-layout><bit-side-nav></bit-side-nav></bit-layout>`,
})
class HostComponent {}

describe("LayoutComponent push/overlay reconciliation", () => {
  // 800px container: fits the nav in push mode up to 26rem (800 - 416 >= 384), overlay past that.
  const ROOT_FONT_SIZE = 16;
  const CONTAINER_WIDTH = 800;

  let stubbedClientWidth = CONTAINER_WIDTH;
  let originalClientWidth: PropertyDescriptor | undefined;
  let fixture: ComponentFixture<HostComponent>;
  let sideNav: SideNavService;
  let stateProvider: DeferredStateProvider;

  beforeAll(() => {
    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => stubbedClientWidth,
    });
  });

  afterAll(() => {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    }
  });

  beforeEach(() => {
    stubbedClientWidth = CONTAINER_WIDTH;
    ResizeObserverStub.latest = undefined;

    // The service converts rem to px through getComputedStyle on <html>.
    document.documentElement.style.fontSize = `${ROOT_FONT_SIZE}px`;
    // SideNavComponent uses matchMedia for touch and reduced-motion detection; CDK's
    // BreakpointObserver reaches for the legacy addListener/removeListener pair.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  /** Boots the layout with the width already hydrated, i.e. past startup. */
  const bootHydrated = (savedWidth = SIDE_NAV_WIDTH_BOUNDS.default) => {
    boot();
    stateProvider.width.deliver(savedWidth);
    settle();
  };

  const boot = () => {
    stateProvider = new DeferredStateProvider();

    TestBed.configureTestingModule({
      imports: [HostComponent, RouterModule.forRoot([])],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              sideNavigation: "Side navigation",
              toggleSideNavigation: "Toggle side navigation",
              resizeSideNavigation: "Resize side navigation",
              toggleCollapse: "Toggle collapse",
              skipToContent: "Skip to content",
              skipLink: "Skip link",
              submenu: "submenu",
            }),
        },
        { provide: GlobalStateProvider, useValue: stateProvider },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    });

    fixture = TestBed.createComponent(HostComponent);
    sideNav = TestBed.inject(SideNavService);
    settle();
  };

  /** Flush change detection, the afterNextRender hook, the width effect, and pending timers. */
  const settle = () => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    tick();
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe("widening the nav past what push mode affords", () => {
    it("goes to overlay rather than collapsing when dragged", fakeAsync(() => {
      bootHydrated();
      expect(sideNav.open()).toBe(true);
      expect(sideNav.isPushMode()).toBe(true);

      // Drag the handle to 27rem (432px) — past the 26rem push ceiling for this container.
      sideNav.setWidthFromDrag(27 * ROOT_FONT_SIZE, 0);
      settle();

      expect(sideNav.open()).toBe(true);
      expect(sideNav.isOverlay()).toBe(true);
    }));

    it("goes to overlay rather than collapsing when resized with arrow keys", fakeAsync(() => {
      bootHydrated();

      // 1rem steps from 18.5rem: the 8th lands on 26.5rem, the first width past the ceiling.
      // Asserting every step matters — a collapse here is otherwise masked by the next
      // ArrowRight, which re-expands through _expand() and lands on overlay anyway.
      for (let i = 0; i < 8; i++) {
        sideNav.setWidthFromKeys("ArrowRight");
        settle();
        expect(sideNav.open()).toBe(true);
      }

      // isDragging is never set on this path, so an isDragging-based guard would not catch it.
      expect(sideNav.isDragging()).toBe(false);
      expect(sideNav.isOverlay()).toBe(true);
    }));

    it("stays open when a drag out from the collapsed rail overshoots the ceiling", fakeAsync(() => {
      bootHydrated();
      sideNav.toggle();
      settle();
      expect(sideNav.open()).toBe(false);

      // A fast flick jumps straight past MIN_OPEN_WIDTH to 27rem in a single pointermove.
      sideNav.setWidthFromDrag(27 * ROOT_FONT_SIZE, 0);
      settle();
      sideNav.onDragEnd();
      settle();

      expect(sideNav.open()).toBe(true);
      expect(sideNav.isOverlay()).toBe(true);
    }));
  });

  describe("space around the nav shrinking", () => {
    it("still closes the nav when the container no longer fits it", fakeAsync(() => {
      bootHydrated();
      expect(sideNav.open()).toBe(true);

      // 18.5rem nav (296px) + 24rem main minimum (384px) no longer fit in 600px.
      stubbedClientWidth = 600;
      ResizeObserverStub.latest!.emit();
      settle();

      expect(sideNav.open()).toBe(false);
    }));
  });

  describe("startup", () => {
    it("collapses when the persisted width arrives too wide for the container", fakeAsync(() => {
      boot();

      // Reconcile once at the default width first. This is the ordering that a `!hasReconciled`
      // guard misses: startup is only over once the persisted width has landed too.
      ResizeObserverStub.latest!.emit();
      settle();
      expect(sideNav.open()).toBe(true);

      // 30rem (480px) leaves only 320px for main, under the 384px minimum.
      stateProvider.width.deliver(30);
      settle();

      expect(sideNav.open()).toBe(false);
    }));

    it("keeps the nav open when the persisted width still fits", fakeAsync(() => {
      boot();
      ResizeObserverStub.latest!.emit();
      settle();

      stateProvider.width.deliver(20);
      settle();

      expect(sideNav.open()).toBe(true);
      expect(sideNav.isPushMode()).toBe(true);
    }));
  });
});
