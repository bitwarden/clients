import { TestBed } from "@angular/core/testing";

import { GlobalStateProvider } from "@bitwarden/state";

import { getRootFontSizePx } from "../shared";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { SideNavService } from "./side-nav.service";

describe("SideNavService", () => {
  let service: SideNavService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider }],
    });
    service = TestBed.inject(SideNavService);
  });

  const currentWidth = () => service.widthRem();

  /** Drag the handle to `rem` from the nav's left edge. */
  const dragTo = (rem: number) => service.setWidthFromDrag(rem * getRootFontSizePx(), 0);

  describe("setWidthFromKeys", () => {
    describe("while collapsed", () => {
      beforeEach(() => {
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
      service.open.set(true);
      expect(service.showLabels()).toBe(true);

      service.open.set(false);
      expect(service.showLabels()).toBe(false);
    });

    it("stays false for a preview narrower than the open-style threshold", () => {
      service.open.set(false);
      service.dragDisplayWidth.set(service.CLOSED_WIDTH + 1);

      expect(service.showLabels()).toBe(false);
      expect(service.open()).toBe(false);
    });

    it("becomes true once the preview passes the threshold, without opening the nav", () => {
      service.open.set(false);
      service.dragDisplayWidth.set(service.CLOSED_WIDTH + 6);

      expect(service.showLabels()).toBe(true);
      // `open` drives push/overlay mode, so it must not flip mid-drag.
      expect(service.open()).toBe(false);
      expect(service.isOverlay()).toBe(false);
    });
  });
});
