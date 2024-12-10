import { CdkVirtualScrollableElement } from "@angular/cdk/scrolling";
import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, Subscription } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class VaultPopupScrollPositionService {
  private router = inject(Router);

  /** Path of the vault screen */
  private readonly vaultPath = "/tabs/vault";

  /** Current scroll position relative to the top of the viewport. */
  private scrollPosition: number | null = null;

  /** Subscription associated with the virtual scroll element. */
  private scrollSubscription: Subscription | null = null;

  /** Stored cipher id when the `/view-cipher`*/
  private viewedCipherId: string | null = null;

  constructor() {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      )
      .subscribe((event) => {
        this.storeViewedCipher(event);
        this.resetListenerForNavigation(event);
      });
  }

  /** Scrolls the user to the stored scroll position and starts tracking scroll of the page. */
  start(virtualScrollElement: CdkVirtualScrollableElement) {
    if (this.scrollPosition) {
      // Use `setTimeout` to scroll after rendering is complete
      setTimeout(async () => {
        // `?? 0` is only to make typescript happy. It shouldn't happen with the above truthy check for `this.scrollPosition`.
        virtualScrollElement.scrollTo({ top: this.scrollPosition ?? 0, behavior: "instant" });

        // wait for scrolling to be complete so the virtual item is rendered
        await this.waitForScroll(virtualScrollElement);

        // Move the users focus to the previous item when available
        if (this.viewedCipherId) {
          const virtualNativeElement = virtualScrollElement.getElementRef().nativeElement;
          const viewedCipherEle: HTMLElement | null = virtualNativeElement.querySelector(
            `[data-id="${this.viewedCipherId}"]`,
          );
          viewedCipherEle?.focus();
          this.viewedCipherId = null;
        }
      });
    }

    this.scrollSubscription?.unsubscribe();

    this.scrollSubscription = virtualScrollElement?.elementScrolled().subscribe(() => {
      const offset = virtualScrollElement.measureScrollOffset("top");
      this.scrollPosition = offset;
    });
  }

  /** Stops the scroll listener from updating the stored location. */
  stop(reset?: true) {
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;

    if (reset) {
      this.viewedCipherId = null;
      this.scrollPosition = null;
    }
  }

  /** Conditionally resets the scroll listeners based on the ending path of the navigation */
  private resetListenerForNavigation(event: NavigationEnd): void {
    // The vault page is the target of the scroll listener, return early
    if (event.url === this.vaultPath) {
      return;
    }

    // For all other tab pages reset the scroll position
    if (event.url.startsWith("/tabs/")) {
      this.stop(true);
    }
  }

  /** Save the cipher id from the URL */
  private storeViewedCipher(event: NavigationEnd): void {
    const urlWithoutHash = event.url.split("#")[0];
    const splitUrl = urlWithoutHash.split("?");
    const queryParams = splitUrl.pop();
    const searchParams = new URLSearchParams(queryParams);

    if (event.url.includes("/view-cipher") && searchParams.has("cipherId")) {
      this.viewedCipherId = searchParams.get("cipherId");
    } else if (!event.url.includes(this.vaultPath)) {
      this.viewedCipherId = null;
    }
  }

  /** Returns a promise that resolves when the provided element is finished scrolling */
  private waitForScroll(virtualScrollElement: CdkVirtualScrollableElement): Promise<void> {
    const abortController = new AbortController();
    const scrollElement = virtualScrollElement.getElementRef().nativeElement;

    return new Promise<void>((resolve) => {
      let prevScrollPos = scrollElement.scrollTop;
      let scrollTimeout = 0;

      /** Check if the scroll has ended. */
      const checkScrollEnd = () => {
        if (scrollElement.scrollTop === prevScrollPos) {
          clearTimeout(scrollTimeout);
          abortController.abort(); // Remove the event listener
          resolve();
        } else {
          prevScrollPos = scrollElement.scrollTop;
          scrollTimeout = window.setTimeout(checkScrollEnd, 100); // Check again after 50ms
        }
      };

      // Attach a scroll event listener to the element
      scrollElement.addEventListener(
        "scroll",
        () => {
          clearTimeout(scrollTimeout); // Clear previous timeout
          scrollTimeout = window.setTimeout(checkScrollEnd, 50); // Check after 50ms
        },
        { signal: abortController.signal },
      );
    });
  }
}
