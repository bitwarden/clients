import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, fromEvent, Subscription } from "rxjs";

import { ScrollLayoutService } from "@bitwarden/components";
import { VAULT_BASE_ROUTE } from "@bitwarden/vault";

@Injectable({
  providedIn: "root",
})
export class VaultPopupScrollPositionService {
  private router = inject(Router);
  private readonly scrollLayout = inject(ScrollLayoutService);

  /** Path of the vault screen */
  private readonly vaultPath = inject(VAULT_BASE_ROUTE);

  /** Current scroll position relative to the top of the viewport. */
  private scrollPosition: number | null = null;

  /** Subscription associated with the virtual scroll element. */
  private scrollSubscription: Subscription | null = null;

  /**
   * Where a restore left the element, or `null`. An event finding it still there is the restore's.
   */
  private restoredTo: number | null = null;

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
  start(scrollElement: HTMLElement) {
    const restoring = this.hasScrollPosition();
    const target = this.scrollPosition;

    if (restoring) {
      // Before the jump paints, so collapsing chrome arrives collapsed rather than animating.
      this.scrollLayout.restoredScrolled.set(target! > 0);

      // Use `setTimeout` to scroll after rendering is complete
      setTimeout(() => {
        scrollElement.scrollTo({ top: target!, behavior: "instant" });
        // From where the jump landed: the vault attaches twice and the first never scrolls.
        this.restoredTo = scrollElement.scrollTop;
        this.scrollLayout.restoredScrolled.set(scrollElement.scrollTop > 0);
      });
    }

    this.scrollSubscription?.unsubscribe();

    this.restoredTo = restoring ? target : null;

    this.scrollSubscription = fromEvent(scrollElement, "scroll").subscribe(() => {
      // By offset, not elapsed time: the event waits a frame, so a timer expires first.
      if (this.restoredTo != null && scrollElement.scrollTop === this.restoredTo) {
        return;
      }

      this.restoredTo = null;
      this.scrollLayout.restoredScrolled.set(false);
      this.scrollPosition = scrollElement.scrollTop;
    });
  }

  /** Stops the scroll listener from updating the stored location. */
  stop(reset?: true) {
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;
    this.restoredTo = null;
    this.scrollLayout.restoredScrolled.set(false);

    if (reset) {
      this.scrollPosition = null;
    }
  }

  /** Returns true when a scroll position has been stored. */
  hasScrollPosition() {
    return this.scrollPosition !== null;
  }

  /** Conditionally resets the scroll listeners based on the ending path of the navigation */
  private resetListenerForNavigation(event: NavigationEnd): void {
    // The vault page is the target of the scroll listener, return early
    if (this.isVaultUrl(event.url)) {
      return;
    }

    // For all other tab pages reset the scroll position
    if (event.url.startsWith("/tabs/")) {
      this.stop(true);
    }
  }

  private isVaultUrl(url: string): boolean {
    const path = url.split("?")[0].split("#")[0];
    return path === this.vaultPath || path.startsWith(`${this.vaultPath}/`);
  }
}
