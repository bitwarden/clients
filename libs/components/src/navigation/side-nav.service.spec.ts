import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { GlobalState, GlobalStateProvider } from "@bitwarden/state";

import { getRootFontSizePx } from "../shared";

import { SIDE_NAV_WIDTH_BOUNDS } from "./side-nav-width.service";
import { SideNavService } from "./side-nav.service";

describe("SideNavService", () => {
  let service: SideNavService;
  let diskWidth$: Subject<number | null>;
  let widthState: MockProxy<GlobalState<number>>;

  beforeEach(() => {
    jest.useFakeTimers();
    diskWidth$ = new BehaviorSubject<number | null>(null);
    widthState = mock<GlobalState<number>>();
    widthState.state$ = diskWidth$.asObservable();

    const provider = mock<GlobalStateProvider>();
    provider.get.mockReturnValue(widthState);

    TestBed.configureTestingModule({
      providers: [{ provide: GlobalStateProvider, useValue: provider }],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Construct the service, optionally with a width already saved. Hydration runs in the
   * constructor, so a saved width has to be seeded before this is called.
   */
  const createService = (savedWidth?: number) => {
    if (savedWidth !== undefined) {
      diskWidth$.next(savedWidth);
    }
    service = TestBed.inject(SideNavService);
    return service;
  };

  const currentWidth = () => service.widthRem();

  /** Drag the handle to `rem` from the nav's left edge. */
  const dragTo = (rem: number) => service.setWidthFromDrag(rem * getRootFontSizePx(), 0);

  /** Flush the persist debounce and return every width that reached disk, in order. */
  const persistedWidths = () =>
    widthState.update.mock.calls.map(([configureState]) =>
      configureState(null as never, null as never),
    );

  /** Advance past the persist debounce so pending writes land. */
  const flushPersist = () => jest.advanceTimersByTime(200);

  describe("persistence", () => {
    /** Drop hydration writes so a test asserts only what its own gesture persisted. */
    const clearPersisted = () => {
      flushPersist();
      widthState.update.mockClear();
    };

    describe("hydration", () => {
      it("adopts a saved width", () => {
        createService(30.5);

        expect(currentWidth()).toBe(30.5);
      });

      it("does not re-persist a width it just read", () => {
        createService(30.5);
        flushPersist();

        expect(persistedWidths()).toEqual([]);
      });

      it("repairs a saved width below the minimum, once", () => {
        createService(14.25);
        flushPersist();

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
        expect(persistedWidths()).toEqual([SIDE_NAV_WIDTH_BOUNDS.min]);
      });

      it("repairs a saved width above the maximum, once", () => {
        createService(40);
        flushPersist();

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.max);
        expect(persistedWidths()).toEqual([SIDE_NAV_WIDTH_BOUNDS.max]);
      });

      it("writes nothing when no width has ever been saved", () => {
        createService();
        flushPersist();

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.default);
        expect(persistedWidths()).toEqual([]);
      });

      it("does not persist the default before a slow disk read resolves", () => {
        // A bare Subject models production, where state$ resolves asynchronously.
        const slowDisk$ = new Subject<number | null>();
        diskWidth$ = slowDisk$;
        widthState.state$ = slowDisk$.asObservable();

        createService();
        jest.advanceTimersByTime(500);

        expect(widthState.update).not.toHaveBeenCalled();

        slowDisk$.next(30.5);
        flushPersist();

        expect(currentWidth()).toBe(30.5);
        expect(persistedWidths()).toEqual([]);
      });

      // _expand() repaints via display(saved()), which is a restore rather than the user choosing
      // a width — so it must not claim ownership and block the stored width from being adopted.
      it("still adopts the stored width when the nav expanded before the read resolved", () => {
        const slowDisk$ = new Subject<number | null>();
        diskWidth$ = slowDisk$;
        widthState.state$ = slowDisk$.asObservable();

        createService();
        service.open.set(false);
        service.toggle();

        slowDisk$.next(30.5);

        expect(currentWidth()).toBe(30.5);
      });

      describe("when the user commits before the read resolves", () => {
        let slowDisk$: Subject<number | null>;

        beforeEach(() => {
          slowDisk$ = new Subject<number | null>();
          diskWidth$ = slowDisk$;
          widthState.state$ = slowDisk$.asObservable();

          createService();
          dragTo(27);
          service.onDragEnd();
        });

        it("keeps the width the user committed", () => {
          slowDisk$.next(30);

          expect(currentWidth()).toBe(27);
        });

        it("does not repair a stale width the user has superseded", () => {
          slowDisk$.next(40);
          flushPersist();

          // Only the user's own commit reaches disk — no repair write for the out-of-bounds value.
          expect(currentWidth()).toBe(27);
          expect(persistedWidths()).toEqual([27]);
        });

        it("still reports hydrated, so transitions are not stranded", () => {
          expect(service.widthHydrated()).toBe(false);

          slowDisk$.next(30);

          expect(service.widthHydrated()).toBe(true);
        });

        it("restores the user's width on a later expand, not the stale one", () => {
          slowDisk$.next(30);

          service.toggle();
          service.toggle();

          expect(currentWidth()).toBe(27);
        });
      });
    });

    // The three ways to expand a collapsed nav must agree.
    describe("expanding a collapsed nav", () => {
      const SAVED = 30.5;

      beforeEach(() => {
        createService(SAVED);
        service.open.set(false);
        clearPersisted();
      });

      // A fourth way to expand the nav should be one more row here.
      it.each([
        ["toggle()", () => service.toggle()],
        ["ArrowRight", () => service.setWidthFromKeys("ArrowRight")],
        [
          "releasing a preview drag",
          () => {
            dragTo(8);
            service.onDragEnd();
          },
        ],
      ])("restores the saved width via %s", (_label, expand) => {
        expand();
        flushPersist();

        expect(service.open()).toBe(true);
        expect(service.userCollapsePreference()).toBe("open");
        expect(currentWidth()).toBe(SAVED);
        expect(persistedWidths()).toEqual([]);
      });
    });

    /**
     * The complete set of widths each gesture persists. A new write site should fail a row here
     * rather than needing someone to have anticipated it.
     *
     * Two rows encode decisions the CL-1240 objective does not specify, and are open to challenge:
     * releasing in the tension zone persists the minimum (symmetric with dragging past the maximum,
     * which persists the maximum), and expanding a collapsed nav persists nothing because restoring
     * a remembered width is not a new preference.
     */
    describe("what each gesture persists", () => {
      const SAVED = 30.5;

      it.each([
        ["closing with toggle()", () => service.toggle(), []],
        ["expanding with toggle()", () => (service.open.set(false), service.toggle()), []],
        [
          "expanding with ArrowRight",
          () => (service.open.set(false), service.setWidthFromKeys("ArrowRight")),
          [],
        ],
        ["ArrowLeft while open", () => service.setWidthFromKeys("ArrowLeft"), [SAVED - 1]],
        ["ArrowRight while open", () => service.setWidthFromKeys("ArrowRight"), [SAVED + 1]],
        ["dragging above the minimum", () => dragTo(24), []],
        ["releasing above the minimum", () => (dragTo(24), service.onDragEnd()), [24]],
        ["dragging into the tension zone", () => dragTo(10), []],
        ["releasing in the tension zone", () => (dragTo(10), service.onDragEnd()), [15]],
        ["dragging past the snap threshold", () => dragTo(3), []],
        ["releasing after snapping closed", () => (dragTo(3), service.onDragEnd()), []],
        [
          "a stepped drag that collapses the nav",
          () => (dragTo(20), dragTo(17), dragTo(15.5), dragTo(3), service.onDragEnd()),
          [],
        ],
        ["previewing out from collapsed", () => (service.open.set(false), dragTo(8)), []],
        [
          "releasing a preview drag",
          () => (service.open.set(false), dragTo(8), service.onDragEnd()),
          [],
        ],
        [
          "releasing a drag out from collapsed",
          () => (service.open.set(false), dragTo(20), service.onDragEnd()),
          [20],
        ],
        [
          "aborting a preview drag",
          () => (service.open.set(false), dragTo(8), dragTo(2), service.onDragEnd()),
          [],
        ],
        [
          "dragging out from collapsed and back again",
          () => (service.open.set(false), dragTo(20), dragTo(2), service.onDragEnd()),
          [],
        ],
      ])("persists %s", (_label, gesture, expected) => {
        createService(SAVED);
        service.open.set(true);
        clearPersisted();

        gesture();
        flushPersist();

        expect(persistedWidths()).toEqual(expected);
      });
    });

    it("persists the minimum when ArrowLeft steps past it", () => {
      // 15.5 puts the requested width below the 15 floor, so the bounds clamp is what binds.
      createService(15.5);
      service.open.set(true);
      clearPersisted();

      service.setWidthFromKeys("ArrowLeft");
      flushPersist();

      // The bounds floor is the user reaching the end of the range, not a container limit, so it
      // is a real preference — collapse and expand must come back at the minimum.
      expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
      expect(persistedWidths()).toEqual([SIDE_NAV_WIDTH_BOUNDS.min]);

      service.toggle();
      service.toggle();

      expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
    });

    describe("drag release", () => {
      it("persists the minimum when released in the tension zone", () => {
        createService(30.5);
        service.open.set(true);
        clearPersisted();

        dragTo(10);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(true);
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
        expect(persistedWidths()).toEqual([SIDE_NAV_WIDTH_BOUNDS.min]);
      });

      it("persists nothing when a drag collapses the nav", () => {
        createService(30.5);
        service.open.set(true);
        clearPersisted();

        dragTo(10);
        dragTo(3);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(false);
        expect(currentWidth()).toBe(30.5);
        expect(persistedWidths()).toEqual([]);
      });

      it("persists nothing when a preview drag is aborted", () => {
        createService(30.5);
        service.open.set(false);
        clearPersisted();

        dragTo(8);
        dragTo(2);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(false);
        expect(persistedWidths()).toEqual([]);
      });

      it("persists one width for a multi-frame drag", () => {
        createService();
        service.open.set(true);
        clearPersisted();

        dragTo(20);
        dragTo(22);
        dragTo(24);

        expect(persistedWidths()).toEqual([]);

        service.onDragEnd();
        flushPersist();

        expect(persistedWidths()).toEqual([24]);
      });
    });

    // The minimum is both a real preference and the value the tension zone springs back to, so
    // the two must not be able to masquerade as each other.
    describe("when the saved width is already the minimum", () => {
      beforeEach(() => {
        createService(15);
        service.open.set(true);
        clearPersisted();
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
      });

      it("survives a drag that collapses the nav", () => {
        dragTo(14);
        dragTo(10);
        dragTo(3);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(false);
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
        expect(persistedWidths()).toEqual([]);

        service.toggle();

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
      });

      it("writes nothing when a tension release reaffirms it", () => {
        dragTo(10);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(true);
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
        expect(persistedWidths()).toEqual([]);
      });

      it("writes nothing when a drag is released without moving off it", () => {
        service.onDragEnd();
        flushPersist();

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
        expect(persistedWidths()).toEqual([]);
      });

      it("is replaced by a wider width once released", () => {
        dragTo(20);
        service.onDragEnd();
        flushPersist();

        expect(currentWidth()).toBe(20);
        expect(persistedWidths()).toEqual([20]);
      });
    });
  });

  describe("setWidthFromKeys", () => {
    describe("while collapsed", () => {
      beforeEach(() => {
        createService();
        service.open.set(false);
      });

      it("expands to the default width on ArrowRight", () => {
        service.setWidthFromKeys("ArrowRight");

        expect(service.open()).toBe(true);
        expect(service.userCollapsePreference()).toBe("open");
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.default);
      });

      it("does nothing on ArrowLeft", () => {
        const widthBefore = currentWidth();

        service.setWidthFromKeys("ArrowLeft");

        expect(service.open()).toBe(false);
        expect(currentWidth()).toBe(widthBefore);
      });

      it("does not shrink the persisted width when ArrowLeft is held", () => {
        const widthBefore = currentWidth();

        for (let i = 0; i < 10; i++) {
          service.setWidthFromKeys("ArrowLeft");
        }

        expect(currentWidth()).toBe(widthBefore);
      });
    });

    describe("while open", () => {
      beforeEach(() => {
        createService();
        service.open.set(true);
      });

      it("widens by one rem on ArrowRight", () => {
        const widthBefore = currentWidth();

        service.setWidthFromKeys("ArrowRight");

        expect(currentWidth()).toBe(widthBefore + 1);
      });

      it("narrows by one rem on ArrowLeft", () => {
        const widthBefore = currentWidth();

        service.setWidthFromKeys("ArrowLeft");

        expect(currentWidth()).toBe(widthBefore - 1);
      });

      it("collapses when ArrowLeft steps off the minimum width", () => {
        while (currentWidth() > SIDE_NAV_WIDTH_BOUNDS.min) {
          service.setWidthFromKeys("ArrowLeft");
        }
        expect(service.open()).toBe(true);

        service.setWidthFromKeys("ArrowLeft");

        expect(service.open()).toBe(false);
        expect(service.userCollapsePreference()).toBe("closed");
      });

      it("does not widen past the maximum", () => {
        for (let i = 0; i < 40; i++) {
          service.setWidthFromKeys("ArrowRight");
        }

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.max);
      });
    });
  });

  describe("setWidthFromDrag", () => {
    describe("while open", () => {
      const CUSTOM_WIDTH = 22;

      beforeEach(() => {
        createService();
        service.open.set(true);
        dragTo(CUSTOM_WIDTH);
        service.onDragEnd();
        expect(currentWidth()).toBe(CUSTOM_WIDTH);
      });

      it("previews the tension shrink without touching the saved width", () => {
        dragTo(10);

        // 15 - (15 - 10) * 0.15
        expect(service.dragDisplayWidth()).toBeCloseTo(14.25);
        expect(currentWidth()).toBe(CUSTOM_WIDTH);
      });

      it("collapses past the snap threshold and clears the preview", () => {
        dragTo(10);

        dragTo(3);

        expect(service.open()).toBe(false);
        expect(service.userCollapsePreference()).toBe("closed");
        expect(service.dragDisplayWidth()).toBeNull();
      });

      it("keeps the customized width when a drag collapses the nav", () => {
        // Step through the widths a real pointer passes on the way down — a 22 -> 10 jump would
        // skip every frame that could overwrite the saved width.
        dragTo(20);
        dragTo(17);
        dragTo(15.5);
        dragTo(10);
        dragTo(3);

        service.onDragEnd();

        expect(service.open()).toBe(false);
        expect(currentWidth()).toBe(CUSTOM_WIDTH);

        // Re-opening restores what the user had, not the minimum.
        service.toggle();
        expect(service.open()).toBe(true);
        expect(currentWidth()).toBe(CUSTOM_WIDTH);
      });

      it("springs back to the minimum when released in the tension zone", () => {
        dragTo(10);

        service.onDragEnd();

        expect(service.open()).toBe(true);
        expect(service.dragDisplayWidth()).toBeNull();
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.min);
      });

      it("does not paint past the maximum", () => {
        dragTo(40);

        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.max);
      });

      it("clears a stale tension preview when dragged back above the minimum", () => {
        dragTo(10);

        dragTo(20);

        expect(service.dragDisplayWidth()).toBeNull();
        expect(currentWidth()).toBe(20);
      });
    });

    describe("while collapsed", () => {
      beforeEach(() => {
        createService();
        service.open.set(false);
      });

      it("previews below the minimum without opening the nav", () => {
        dragTo(8);

        expect(service.open()).toBe(false);
        expect(service.dragDisplayWidth()).toBe(8);
      });

      it("aborts the preview when dragged back onto the icon strip", () => {
        dragTo(8);

        dragTo(2);

        expect(service.open()).toBe(false);
        expect(service.dragDisplayWidth()).toBeNull();
      });

      it("commits to open once the drag crosses the minimum", () => {
        dragTo(20);

        expect(service.open()).toBe(true);
        expect(service.userCollapsePreference()).toBe("open");
        expect(service.dragDisplayWidth()).toBeNull();
        expect(currentWidth()).toBe(20);
      });

      it("commits to open at the default width when released in the preview zone", () => {
        dragTo(8);

        service.onDragEnd();

        expect(service.open()).toBe(true);
        expect(service.dragDisplayWidth()).toBeNull();
        expect(currentWidth()).toBe(SIDE_NAV_WIDTH_BOUNDS.default);
      });
    });
  });

  describe("preview drag", () => {
    it("does not open the nav or flip to overlay mode", () => {
      createService();
      service.isPushMode.set(true);
      service.open.set(false);
      const widthBefore = currentWidth();

      dragTo(10);

      // `open` drives push/overlay mode, so a preview must not flip it mid-gesture.
      expect(service.open()).toBe(false);
      expect(service.isOverlay()).toBe(false);
      expect(currentWidth()).toBe(widthBefore);
      expect(service.dragDisplayWidth()).toBe(10);
    });
  });
});
