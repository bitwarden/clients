/**
 * Hosts content pinned to the bottom of the layout's main content area — e.g. a bulk-actions bar.
 * Replaces `LayoutFooterService`: instead of a portal, attach an element.
 *
 * The layout renders it in a region that overlaps `<main>` but sits outside its scroll container,
 * so the content stays pinned to the viewport while `<main>` scrolls and is horizontally aligned to
 * the main content column. Detach it when the owning view goes away. Content can also be placed
 * directly with `slot="footer"` on a child of `bit-layout`.
 */
class LayoutFooter {
  private _element?: HTMLElement;
  private readonly listeners = new Set<() => void>();

  /** The element to display in the layout footer region. */
  get element(): HTMLElement | undefined {
    return this._element;
  }

  attach(element: HTMLElement) {
    this._element = element;
    this.notify();
  }

  detach(element: HTMLElement) {
    if (element === this._element) {
      this._element = undefined;
      element.remove();
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

export const layoutFooter = new LayoutFooter();
