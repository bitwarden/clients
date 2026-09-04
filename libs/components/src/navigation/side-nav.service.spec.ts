import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { GlobalState, GlobalStateProvider } from "@bitwarden/state";

import { getRootFontSizePx } from "../shared";

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

        expect(currentWidth()).toBe(service.MIN_OPEN_WIDTH);
        expect(persistedWidths()).toEqual([service.MIN_OPEN_WIDTH]);
      });

      it("repairs a saved width above the maximum, once", () => {
        createService(40);
        flushPersist();

        expect(currentWidth()).toBe(service.MAX_OPEN_WIDTH);
        expect(persistedWidths()).toEqual([service.MAX_OPEN_WIDTH]);
      });

      it("writes nothing when no width has ever been saved", () => {
        createService();
        flushPersist();

        expect(currentWidth()).toBe(service.DEFAULT_OPEN_WIDTH);
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

      it("never narrows the saved width to what the container can push", () => {
        createService(30.5);
        clearPersisted();

        service.maxPushWidthRem.set(20);
        flushPersist();

        expect(persistedWidths()).toEqual([]);
      });
    });

    // The three ways to expand a collapsed nav must agree. Today only toggle() does.
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

    describe("drag release", () => {
      it("persists the minimum when released in the tension zone", () => {
        createService(30.5);
        service.open.set(true);
        clearPersisted();

        dragTo(10);
        service.onDragEnd();
        flushPersist();

        expect(service.open()).toBe(true);
        expect(currentWidth()).toBe(service.MIN_OPEN_WIDTH);
        expect(persistedWidths()).toEqual([service.MIN_OPEN_WIDTH]);
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

        flushPersist();

        expect(persistedWidths()).toEqual([24]);
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
        expect(currentWidth()).toBe(service.DEFAULT_OPEN_WIDTH);
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
        while (currentWidth() > service.MIN_OPEN_WIDTH) {
          service.setWidthFromKeys("ArrowLeft");
        }
        expect(service.open()).toBe(true);

        service.setWidthFromKeys("ArrowLeft");

        expect(service.open()).toBe(false);
        expect(service.userCollapsePreference()).toBe("closed");
      });

      it("does not widen past the space the container can push", () => {
        service.maxPushWidthRem.set(20);

        for (let i = 0; i < 30; i++) {
          service.setWidthFromKeys("ArrowRight");
        }

        expect(currentWidth()).toBe(20);
      });

      it("does not widen past MAX_OPEN_WIDTH when the container is unconstrained", () => {
        for (let i = 0; i < 40; i++) {
          service.setWidthFromKeys("ArrowRight");
        }

        expect(currentWidth()).toBe(service.MAX_OPEN_WIDTH);
      });

      it("never clamps below MIN_OPEN_WIDTH, even in a container too small to push", () => {
        service.maxPushWidthRem.set(5);

        service.setWidthFromKeys("ArrowRight");

        expect(currentWidth()).toBe(service.MIN_OPEN_WIDTH);
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
        expect(currentWidth()).toBe(service.MIN_OPEN_WIDTH);
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
        expect(currentWidth()).toBe(service.DEFAULT_OPEN_WIDTH);
      });
    });
  });

  describe("showLabels", () => {
    it("follows `open` when no preview drag is active", () => {
      createService();
      service.open.set(true);
      expect(service.showLabels()).toBe(true);

      service.open.set(false);
      expect(service.showLabels()).toBe(false);
    });

    it("stays false for a preview narrower than the open-style threshold", () => {
      createService();
      service.open.set(false);
      service.dragDisplayWidth.set(service.CLOSED_WIDTH + 1);

      expect(service.showLabels()).toBe(false);
      expect(service.open()).toBe(false);
    });

    it("becomes true once the preview passes the threshold, without opening the nav", () => {
      createService();
      service.open.set(false);
      service.dragDisplayWidth.set(service.CLOSED_WIDTH + 6);

      expect(service.showLabels()).toBe(true);
      // `open` drives push/overlay mode, so it must not flip mid-drag.
      expect(service.open()).toBe(false);
      expect(service.isOverlay()).toBe(false);
    });
  });
});
