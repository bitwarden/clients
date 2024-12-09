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
    service["viewedCipherId"] = "cipher-1";
  });

  describe("router events", () => {
    it("does not reset service when navigating to `/tabs/vault`", fakeAsync(() => {
      const event = new NavigationEnd(22, "/tabs/vault", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBe(234);
      expect(service["scrollSubscription"]).not.toBeNull();
      expect(service["viewedCipherId"]).toBe("cipher-1");
    }));

    it("resets values when navigating to other tab pages", fakeAsync(() => {
      const event = new NavigationEnd(23, "/tabs/generator", "");
      events$.next(event);

      tick();

      expect(service["scrollPosition"]).toBeNull();
      expect(unsubscribe).toHaveBeenCalled();
      expect(service["scrollSubscription"]).toBeNull();
      expect(service["viewedCipherId"]).toBeNull();
    }));

    it("stores the viewed cipher when navigating to the `/view-cipher` route", fakeAsync(() => {
      const event = new NavigationEnd(
        24,
        "/view-cipher?cipherId=cipher-23&type=2#included-hash",
        "",
      );
      events$.next(event);

      tick();

      expect(service["viewedCipherId"]).toBe("cipher-23");
    }));

    it("clears the viewed cipher when navigating to a page other than the vault", fakeAsync(() => {
      const event = new NavigationEnd(25, "/tabs/settings", "");
      events$.next(event);

      tick();

      expect(service["viewedCipherId"]).toBeNull();
    }));
  });

  describe("stop", () => {
    it("removes scroll listener", () => {
      service.stop();

      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(service["scrollSubscription"]).toBeNull();
    });

    it("resets stored values", () => {
      service.stop(true);

      expect(service["scrollPosition"]).toBeNull();
      expect(service["viewedCipherId"]).toBeNull();
    });
  });

  describe("start", () => {
    const elementScrolled$ = new Subject();
    const focus = jest.fn();
    const nativeElement = {
      scrollTop: 0,
      querySelector: jest.fn(() => ({ focus })),
      addEventListener: jest.fn(),
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
        service["viewedCipherId"] = null;
      });

      it("does not scroll when `scrollPosition` is null", () => {
        service["scrollPosition"] = null;

        service.start(virtualElement);

        expect(virtualElement.scrollTo).not.toHaveBeenCalled();
      });

      it("scrolls the virtual element to `scrollPosition`", fakeAsync(() => {
        service["scrollPosition"] = 500;

        service.start(virtualElement);

        nativeElement.scrollTop = 500;
        tick(100);

        expect(virtualElement.scrollTo).toHaveBeenCalledWith({ behavior: "instant", top: 500 });
      }));

      it("focuses on the `viewedCipherId`", fakeAsync(() => {
        service["viewedCipherId"] = "cipher-23";
        service["scrollPosition"] = 500;
        nativeElement.scrollTop = 0;

        service.start(virtualElement);

        tick();

        const eventListener = nativeElement.addEventListener.mock.calls[1][1];

        eventListener();

        tick(50);

        expect(nativeElement.querySelector).toHaveBeenCalledWith('[data-id="cipher-23"]');
        expect(focus).toHaveBeenCalled();
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

        elementScrolled$.next(null);
        tick();

        expect(virtualElement.measureScrollOffset).toHaveBeenCalledOnce();
        expect(virtualElement.measureScrollOffset).toHaveBeenCalledWith("top");
        expect(service["scrollPosition"]).toBe(455);
      }));
    });
  });
});
