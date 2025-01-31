import { CdkVirtualScrollableElement } from "@angular/cdk/scrolling";
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
    const elementScrolled$ = new Subject();
    const focus = jest.fn();
    const nativeElement = {
      scrollTop: 0,
      querySelector: jest.fn(() => ({ focus })),
      addEventListener: jest.fn(),
      style: {
        visibility: "",
      },
    };
    const virtualElement = {
      elementScrolled: () => elementScrolled$,
      getElementRef: () => ({ nativeElement }),
      scrollTo: jest.fn(),
    } as unknown as CdkVirtualScrollableElement;

    afterEach(() => {
      // remove the actual subscription created by `.subscribe`
      service["scrollSubscription"]?.unsubscribe();
    });

    describe("initial scroll position", () => {
      beforeEach(() => {
        (virtualElement.scrollTo as jest.Mock).mockClear();
        nativeElement.querySelector.mockClear();
      });

      it("does not scroll when `scrollPosition` is null", () => {
        service["scrollPosition"] = null;

        service.start(virtualElement);

        expect(virtualElement.scrollTo).not.toHaveBeenCalled();
      });

      it("scrolls the virtual element to `scrollPosition`", fakeAsync(() => {
        service["scrollPosition"] = 500;
        nativeElement.scrollTop = 500;

        service.start(virtualElement);
        tick();

        expect(virtualElement.scrollTo).toHaveBeenCalledWith({ behavior: "instant", top: 500 });
      }));
    });

    describe("scroll listener", () => {
      it("unsubscribes from any existing subscription", () => {
        service.start(virtualElement);

        expect(unsubscribe).toHaveBeenCalled();
      });

      it("subscribes to `elementScrolled`", fakeAsync(() => {
        virtualElement.measureScrollOffset = jest.fn(() => 455);

        service.start(virtualElement);

        elementScrolled$.next(null); // first subscription is skipped by `skip(1)`
        elementScrolled$.next(null);
        tick();

        expect(virtualElement.measureScrollOffset).toHaveBeenCalledTimes(1);
        expect(virtualElement.measureScrollOffset).toHaveBeenCalledWith("top");
        expect(service["scrollPosition"]).toBe(455);
      }));
    });
  });
});
