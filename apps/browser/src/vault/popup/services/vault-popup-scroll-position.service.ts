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

  constructor() {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      )
      .subscribe((event) => {
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
}
