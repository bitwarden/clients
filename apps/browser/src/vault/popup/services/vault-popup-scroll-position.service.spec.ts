import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { NavigationEnd, Router } from "@angular/router";
import { Subject, Subscription } from "rxjs";

import { VaultPopupScrollPositionService } from "./vault-popup-scroll-position.service";

describe("VaultPopupScrollPositionService", () => {
  let service: VaultPopupScrollPositionService;
  const events$ = new Subject();
  const unsubscribe = jest.fn();

  beforeEach(async () => {
    unsubscribe.mockClear();

    await TestBed.configureTestingModule({
      providers: [
        VaultPopupScrollPositionService,
        { provide: Router, useValue: { events: events$ } },
      ],
    });

    service = TestBed.inject(VaultPopupScrollPositionService);

    // set up dummy values
    service["scrollPosition"] = 234;
    service["scrollSubscription"] = { unsubscribe } as unknown as Subscription;
  });

  describe("router events", () => {
    it("does not reset service when navigating to `/tabs/vault`", fakeAsync(() => {
      const event = new NavigationEnd(22, "/tabs/vault", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBe(234);
      expect(service["scrollSubscription"]).not.toBeNull();
    }));

    it("resets values when navigating to other tab pages", fakeAsync(() => {
      const event = new NavigationEnd(23, "/tabs/generator", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBeNull();
      expect(unsubscribe).toHaveBeenCalled();
      expect(service["scrollSubscription"]).toBeNull();
    }));
  });

  describe("stop", () => {
    it("removes scroll listener", () => {
      service.stop();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(service["scrollSubscription"]).toBeNull();
    });

    it("resets stored values", () => {
      service.stop(true);

      expect(service["scrollPosition"]).toBeNull();
    });
  });

  describe("start", () => {
    let scrollElement: HTMLElement;

    beforeEach(() => {
      scrollElement = document.createElement("div");

      (scrollElement as any).scrollTo = jest.fn(function scrollTo(opts: { top?: number }) {
        if (opts?.top != null) {
          (scrollElement as any).scrollTop = opts.top;
        }
      });
      (scrollElement as any).scrollTop = 0;
    });

    afterEach(() => {
      // remove the actual subscription created by `.subscribe`
      service["scrollSubscription"]?.unsubscribe();
    });

    describe("initial scroll position", () => {
      beforeEach(() => {
        ((scrollElement as any).scrollTo as jest.Mock).mockClear();
      });

      it("does not scroll when `scrollPosition` is null", () => {
        service["scrollPosition"] = null;

        service.start(scrollElement);

        expect((scrollElement as any).scrollTo).not.toHaveBeenCalled();
      });

      it("scrolls the element to `scrollPosition` (async via setTimeout)", fakeAsync(() => {
        service["scrollPosition"] = 500;

        service.start(scrollElement);
        tick();

        expect((scrollElement as any).scrollTo).toHaveBeenCalledWith({
          behavior: "instant",
          top: 500,
        });
        expect((scrollElement as any).scrollTop).toBe(500);
      }));
    });

    describe("scroll listener", () => {
      it("unsubscribes from any existing subscription", () => {
        service.start(scrollElement);

        expect(unsubscribe).toHaveBeenCalled();
      });

      it("stores scrollTop on subsequent scroll events (skips first)", fakeAsync(() => {
        service["scrollPosition"] = null;

        service.start(scrollElement);

        // First scroll event is intentionally ignored (equivalent to old skip(1)).
        (scrollElement as any).scrollTop = 111;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBeNull();

        // Second scroll event should persist.
        (scrollElement as any).scrollTop = 455;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(455);
      }));
    });
  });
});
