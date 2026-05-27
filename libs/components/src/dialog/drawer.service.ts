import { Injectable, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { distinctUntilChanged, filter, map, startWith } from "rxjs";

import { DrawerRef } from "./dialog-ref";

/**
 * @internal
 *
 * Controls the drawer stack.
 *
 * External consumers should use `DialogService.openDrawer`.
 */
@Injectable({ providedIn: "root" })
export class DrawerService {
  private readonly router = inject(Router, { optional: true });
  private readonly stack = signal<DrawerRef<any, any>[]>([]);

  /** The portal at the top of the stack — rendered by LayoutComponent. */
  readonly portal = computed(() => this.stack().at(-1)?.portal);

  /** Number of portals currently in the stack. */
  readonly stackDepth = computed(() => this.stack().length);

  /**
   * The drawer's preferred push-mode column width in px.
   * Declared by the drawer content (e.g. bit-dialog) via declarePushWidth().
   * Zero when no drawer is active or the width has not been declared yet.
   */
  readonly pushWidthPx = signal(0);

  /**
   * Whether the drawer is currently in push mode (occupying its own grid column).
   * Set by LayoutComponent via ResizeObserver; read by the drawer content for display.
   */
  readonly isPushMode = signal(false);

  constructor() {
    if (this.router?.events) {
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          map((event) => event.urlAfterRedirects.split("?")[0]),
          startWith(this.router.url.split("?")[0]),
          distinctUntilChanged(),
          filter(() => this.stack()[0]?.closeOnNavigation === true),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.forceCloseAll());
    }
  }

  /** Push a ref onto the stack. */
  push(ref: DrawerRef<any, any>) {
    this.stack.update((s) => [...s, ref]);
  }

  /** Pop the top ref off the stack. No-op if the stack is empty. */
  pop() {
    if (this.stack().length === 0) {
      return;
    }
    this.stack.update((s) => s.slice(0, -1));
    if (this.stack().length === 0) {
      this.pushWidthPx.set(0);
      this.isPushMode.set(false);
    }
  }

  /** Return true if the given ref is currently on top of the stack. */
  isTop(ref: DrawerRef<any, any>): boolean {
    const s = this.stack();
    return s.length > 0 && s[s.length - 1] === ref;
  }

  /**
   * Close drawers top-to-bottom, stopping at the first whose closePredicate rejects
   * or whose `disableClose` is true. Drawers above the blocking one are already closed
   * by the time we return; that drawer and any below it remain. Returns true if the
   * entire stack was closed.
   */
  async closeAll(): Promise<boolean> {
    while (this.stack().length > 0) {
      const top = this.stack()[this.stack().length - 1];
      if (top.disableClose) {
        return false;
      }
      const { closed } = await top.close();
      if (!closed) {
        return false;
      }
    }
    return true;
  }

  /** Clear the entire stack, bypassing all closePredicates. */
  forceCloseAll(): void {
    const refs = [...this.stack()].reverse();
    this.stack.set([]);
    this.pushWidthPx.set(0);
    this.isPushMode.set(false);
    for (const ref of refs) {
      ref._forceClose();
    }
  }

  /**
   * Called by drawer content components (e.g. bit-dialog) to declare their natural
   * push-mode column width so LayoutComponent can make accurate push/overlay decisions
   * without measuring the DOM (which is unreliable when the column is 1fr).
   */
  declarePushWidth(px: number) {
    this.pushWidthPx.set(px);
  }
}
