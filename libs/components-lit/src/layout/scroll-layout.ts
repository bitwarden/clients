import { attachDirective } from "./attach-directive";

/**
 * Tracks the primary scrollable area of the current layout (`bit-layout`'s `<main>`, or another
 * host marked with `attachScrollLayoutHost`). Replaces `ScrollLayoutService`.
 *
 * Virtual scrollers that should scroll with the page (Angular's `bitScrollLayout`) can use
 * `scrollLayout.scrollable` as their scroll element.
 */
class ScrollLayout {
  private _scrollable: HTMLElement | null = null;
  private _restoredScrolled = false;
  private readonly listeners = new Set<() => void>();

  /** The current layout's scroll container. */
  get scrollable(): HTMLElement | null {
    return this._scrollable;
  }

  /** @internal */
  setScrollable(element: HTMLElement | null) {
    if (element !== this._scrollable) {
      this._scrollable = element;
      this.notify();
    }
  }

  /** Whether the page is restoring a scroll position, so collapsing regions start collapsed. */
  get restoredScrolled(): boolean {
    return this._restoredScrolled;
  }
  set restoredScrolled(value: boolean) {
    if (value !== this._restoredScrolled) {
      this._restoredScrolled = value;
      this.notify();
    }
  }

  /** Runs `listener` on any change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const scrollLayout = new ScrollLayout();

/** Marks `element` as the primary scrollable area of a layout. Replaces `bitScrollLayoutHost`. */
export function attachScrollLayoutHost(element: HTMLElement): { destroy(): void } {
  const previous = scrollLayout.scrollable;
  scrollLayout.setScrollable(element);
  return {
    destroy() {
      // Only restore if this host is still the active one; out-of-order destruction must not
      // clobber a live host.
      if (scrollLayout.scrollable === element) {
        scrollLayout.setScrollable(previous?.isConnected ? previous : null);
      }
    },
  };
}

/** Lit directive for `attachScrollLayoutHost`. */
export const scrollLayoutHost = attachDirective<void>(
  (el) => attachScrollLayoutHost(el),
  "scrollLayoutHost",
);
