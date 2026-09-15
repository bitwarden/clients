import { effect } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { NavigationEnd, Router } from "@angular/router";
import { Subject, Subscription } from "rxjs";

import { ScrollCollapseService, ScrollLayoutService } from "@bitwarden/components";
import { VAULT_BASE_ROUTE } from "@bitwarden/vault";

import { VaultPopupScrollPositionService } from "./vault-popup-scroll-position.service";

/**
 * A realistic `scrollTo`: `scrollTop` updates synchronously, clamped to `maxTop`, but the event
 * waits a frame. Dispatching synchronously is an ordering the browser never produces.
 */
const stubScrollTo = (el: HTMLElement, maxTop = Number.MAX_SAFE_INTEGER) => {
  // Geometry to match, since the restore only declares itself when the scroller can afford to give
  // the collapsing chrome's height back.
  const clientHeight = 500;
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(el, "scrollHeight", {
    value: Math.min(maxTop, 100_000) + clientHeight,
    configurable: true,
  });

  (el as any).scrollTop = 0;
  (el as any).scrollTo = jest.fn((opts: { top?: number }) => {
    const next = Math.min(opts?.top ?? 0, maxTop);
    if (next === (el as any).scrollTop) {
      return;
    }
    (el as any).scrollTop = next;
    setTimeout(() => el.dispatchEvent(new Event("scroll")), 16);
  });
  return el;
};

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
        // The popup's own vault path, which the app supplies in `services.module.ts`.
        { provide: VAULT_BASE_ROUTE, useValue: "/tabs/vault" },
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

    it.each([
      ["/tabs/vault/my-vault"],
      ["/tabs/vault/11111111-1111-4111-8111-111111111111"],
      ["/tabs/vault/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222"],
      ["/tabs/vault/trash"],
    ])(
      "does not reset service when navigating to the scoped vault route %s",
      fakeAsync((url: string) => {
        const event = new NavigationEnd(22, url, "");
        events$.next(event);

        tick();

        expect(service["scrollPosition"]).toBe(234);
        expect(service["scrollSubscription"]).not.toBeNull();
      }),
    );

    it("does not reset service when the vault route carries a query string", fakeAsync(() => {
      const event = new NavigationEnd(22, "/tabs/vault/my-vault?search=foo", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBe(234);
    }));

    it("resets values on a tab page that merely shares the vault prefix", fakeAsync(() => {
      const event = new NavigationEnd(23, "/tabs/vault-settings", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBeNull();
      expect(service["scrollSubscription"]).toBeNull();
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
      scrollElement = stubScrollTo(document.createElement("div"));
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

      it("keeps the stored position when a restore is clamped to a shorter list", fakeAsync(() => {
        // A shorter list cannot honor the saved offset, so the browser clamps it.
        stubScrollTo(scrollElement, 40);
        service["scrollPosition"] = 234;

        service.start(scrollElement);
        tick(100);

        expect(service["scrollPosition"]).toBe(234);
      }));

      it("tracks the user's scrolling again once a restore has settled", fakeAsync(() => {
        service["scrollPosition"] = 234;

        service.start(scrollElement);
        tick();

        (scrollElement as any).scrollTop = 300;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(300);
      }));

      it("re-targets onto a replaced scroll element", fakeAsync(() => {
        // Navigating rebuilds `popup-page`, detaching the element the listener was tracking.
        service["scrollPosition"] = 234;
        service.start(scrollElement);
        tick();

        const replacement = document.createElement("div");
        (replacement as any).scrollTo = jest.fn();
        (replacement as any).scrollTop = 0;

        service.start(replacement);
        tick();

        expect((replacement as any).scrollTo).toHaveBeenCalledWith({
          behavior: "instant",
          top: 234,
        });

        // The detached element must no longer feed the stored position.
        (scrollElement as any).scrollTop = 999;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(234);

        // The live one does.
        (replacement as any).scrollTop = 150;
        replacement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(150);
      }));

      it("declares the restored-scrolled state before applying the offset", fakeAsync(() => {
        // The bar's height comes out of the viewport, so it must collapse before the jump.
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        const order: string[] = [];

        ((scrollElement as any).scrollTo as jest.Mock).mockImplementation(() =>
          order.push("scrollTo"),
        );
        TestBed.runInInjectionContext(() => {
          effect(() => {
            if (scrollLayout.restoredScrolled()) {
              order.push("collapsed");
            }
          });
        });

        service["scrollPosition"] = 234;
        service.start(scrollElement);
        TestBed.flushEffects();
        tick();

        expect(order).toEqual(["collapsed", "scrollTo"]);
      }));

      it("hands the bar back to scroll tracking once the user scrolls", fakeAsync(() => {
        const scrollLayout = TestBed.inject(ScrollLayoutService);

        service["scrollPosition"] = 234;
        service.start(scrollElement);
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(true);

        (scrollElement as any).scrollTop = 300;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(false);
      }));

      it("holds the state through the height the collapse hands back", fakeAsync(() => {
        // The collapse gives its height to the scroller, so the range left to scroll shrinks by
        // exactly the chrome. Re-measuring after it closes would read that as too short and hand
        // the chrome straight back, animating it open under the user.
        TestBed.inject(ScrollCollapseService).register(() => 130);
        stubScrollTo(scrollElement, 200);
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = 200;

        service.start(scrollElement);
        expect(scrollLayout.restoredScrolled()).toBe(true);

        // The chrome has collapsed; its height belongs to the scroller now.
        Object.defineProperty(scrollElement, "clientHeight", { value: 630, configurable: true });
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(true);
      }));

      it("does not declare the state when the list is too short to afford the collapse", fakeAsync(() => {
        // 104px left to scroll against 130px of chrome: collapsing would clamp the offset and
        // reopen the chrome against the user (CL-1318).
        TestBed.inject(ScrollCollapseService).register(() => 130);
        stubScrollTo(scrollElement, 104);
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = 100;

        service.start(scrollElement);
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(false);
      }));

      it("does not declare the state when there is nothing to restore", fakeAsync(() => {
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = null;

        service.start(scrollElement);
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(false);
      }));

      it("clears the declared state on stop", fakeAsync(() => {
        const scrollLayout = TestBed.inject(ScrollLayoutService);

        service["scrollPosition"] = 234;
        service.start(scrollElement);
        tick();

        service.stop();

        expect(scrollLayout.restoredScrolled()).toBe(false);
      }));

      /**
       * The vault attaches twice and the first never scrolls, so the no-op restore cancelled the real one.
       */
      describe("across the vault's two-phase attach", () => {
        /** `popup-page`'s region wraps the table exactly, so it never overflows. */
        const region = () => stubScrollTo(document.createElement("div"), 0);
        /** The table's own viewport, which does scroll. */
        const viewport = () => stubScrollTo(document.createElement("div"), 1000);

        it("keeps the declared state when the second attach restores the offset", fakeAsync(() => {
          const scrollLayout = TestBed.inject(ScrollLayoutService);
          const live = viewport();
          service["scrollPosition"] = 234;

          service.start(region());
          service.start(live);
          tick();

          expect((live as any).scrollTop).toBe(234);
          expect(scrollLayout.restoredScrolled()).toBe(true);

          service["scrollSubscription"]?.unsubscribe();
        }));

        it("clears it when the restore lands at the top", fakeAsync(() => {
          const scrollLayout = TestBed.inject(ScrollLayoutService);
          service["scrollPosition"] = 0;

          service.start(region());
          service.start(viewport());
          tick();

          expect(scrollLayout.restoredScrolled()).toBe(false);

          service["scrollSubscription"]?.unsubscribe();
        }));
      });

      /** A guard cleared on a timer expires before the restore's own event, a frame later. */
      it("holds the declared state through the restore's own deferred event", fakeAsync(() => {
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = 500;

        service.start(scrollElement);
        tick(100);

        expect((scrollElement as any).scrollTop).toBe(500);
        expect(scrollLayout.restoredScrolled()).toBe(true);
        expect(service["scrollPosition"]).toBe(500);
      }));

      it("hands over to the user once they scroll away from the restored offset", fakeAsync(() => {
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = 500;

        service.start(scrollElement);
        tick(100);

        (scrollElement as any).scrollTop = 300;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(false);
        expect(service["scrollPosition"]).toBe(300);
      }));

      it("does not leave the restored state declared after stop", fakeAsync(() => {
        // The deferred jump belongs to the attach that scheduled it. Applied after a stop, it
        // would raise the state with no listener and no later attach left to clear it.
        const scrollLayout = TestBed.inject(ScrollLayoutService);
        service["scrollPosition"] = 234;

        service.start(scrollElement);
        service.stop(true);
        tick();

        expect(scrollLayout.restoredScrolled()).toBe(false);
      }));

      it("does not leave the restore guard raised after stop", fakeAsync(() => {
        service["scrollPosition"] = 234;

        service.start(scrollElement);
        service.stop();
        tick();

        service.start(scrollElement);
        tick();

        (scrollElement as any).scrollTop = 321;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(321);
      }));

      it("stores the first scroll when there was nothing to restore", fakeAsync(() => {
        // With nothing to restore the first event is the user's own; discarding it stored nothing.
        service["scrollPosition"] = null;

        service.start(scrollElement);

        (scrollElement as any).scrollTop = 111;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(111);
      }));

      it("keeps storing scrollTop on later scroll events", fakeAsync(() => {
        service["scrollPosition"] = null;

        service.start(scrollElement);

        (scrollElement as any).scrollTop = 111;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        (scrollElement as any).scrollTop = 455;
        scrollElement.dispatchEvent(new Event("scroll"));
        tick();

        expect(service["scrollPosition"]).toBe(455);
      }));
    });
  });
});
