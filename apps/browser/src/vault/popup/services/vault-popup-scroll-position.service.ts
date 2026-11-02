import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, fromEvent, Subscription } from "rxjs";

import { ScrollCollapseService, ScrollLayoutService } from "@bitwarden/components";
import { VAULT_BASE_ROUTE } from "@bitwarden/vault";

@Injectable({
  providedIn: "root",
})
export class VaultPopupScrollPositionService {
  private router = inject(Router);
  private readonly scrollLayout = inject(ScrollLayoutService);
  private readonly scrollCollapse = inject(ScrollCollapseService);

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

  /** The element currently being tracked, so a deferred jump knows whether it is still wanted. */
  private attached: HTMLElement | null = null;

  /** Whether the collapsing regions were collapsed when the user left the vault. */
  private collapsed = false;

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
      const collapse = this.restoresCollapse();

      // Before the jump paints, so the collapsing regions arrive collapsed rather than animating.
      this.scrollLayout.restoredScrolled.set(collapse);

      // Use `setTimeout` to scroll after rendering is complete
      setTimeout(() => {
        // A later attach, or a `stop()`, may have landed in the meantime — this jump belongs to
        // neither, and applying it would raise the restore state with nothing left to clear it.
        if (this.attached !== scrollElement) {
          return;
        }

        scrollElement.scrollTo({ top: target!, behavior: "instant" });
        // From where the jump landed: the vault attaches twice and the first never scrolls.
        this.restoredTo = scrollElement.scrollTop;
        this.scrollLayout.restoredScrolled.set(scrollElement.scrollTop > 0 && collapse);
      });
    }

    this.scrollSubscription?.unsubscribe();

    this.attached = scrollElement;
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
    this.attached = null;
    this.restoredTo = null;
    // Read before clearing: `direction` reports `"down"` while a restore holds.
    this.collapsed = this.scrollCollapse.direction() === "down";
    this.scrollLayout.restoredScrolled.set(false);

    if (reset) {
      this.scrollPosition = null;
    }
  }

  /** Returns true when a scroll position has been stored. */
  hasScrollPosition() {
    return this.scrollPosition !== null;
  }

  /**
   * Whether the vault returns collapsed: only if the user left it so, which was afforded then and
   * can't clamp the offset (CL-1318).
   */
  restoresCollapse() {
    return (this.scrollPosition ?? 0) > 0 && this.collapsed;
  }

  /** Conditionally resets the scroll listeners based on the ending path of the navigation */
  private resetListenerForNavigation(event: NavigationEnd): void {
    if (this.isVaultUrl(event.url)) {
      // Only on arrival, so the regions paint collapsed while the list loads; `start()` confirms.
      if (this.attached == null) {
        this.scrollLayout.restoredScrolled.set(this.restoresCollapse());
      }
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
