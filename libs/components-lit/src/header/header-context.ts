import { createContext } from "@lit/context";

/**
 * Coordinates `bit-header` with a breadcrumbs component slotted into it.
 *
 * `bit-header` provides an instance through the context protocol. Unlike Angular's element
 * injector, context requests travel the rendered (flattened) tree, so breadcrumbs forwarded through
 * a wrapper's slot into `bit-header` still reach it. A wrapper may also provide its own instance
 * (`new ContextProvider(host, headerContext, new HeaderContext())`); `bit-header` then shares it.
 */
export class HeaderContext {
  /**
   * Whether a slotted breadcrumbs component should promote its active crumb to the page `<h1>`.
   * Set by `bit-header`: `false` while it renders the `legacy` layout.
   *
   * Remove with `legacy` — promotion then follows solely from the presence of a `HeaderContext`.
   */
  get promoteActiveBreadcrumb(): boolean {
    return this._promoteActiveBreadcrumb;
  }
  set promoteActiveBreadcrumb(value: boolean) {
    if (value !== this._promoteActiveBreadcrumb) {
      this._promoteActiveBreadcrumb = value;
      this.notify();
    }
  }
  private _promoteActiveBreadcrumb = true;

  private promotedOwner?: object;
  private promoted = false;
  private readonly listeners = new Set<() => void>();

  /**
   * Whether a slotted breadcrumbs component has taken over rendering the page's `<h1>`, in which
   * case `bit-header` must not render its own.
   */
  get hasPromotedHeading(): boolean {
    return this.promotedOwner != null && this.promoted;
  }

  /** Called by breadcrumbs whenever whether they render the page's `<h1>` changes. */
  setPromotedHeading(owner: object, promoted: boolean) {
    this.promotedOwner = owner;
    this.promoted = promoted;
    this.notify();
  }

  /**
   * Called by breadcrumbs on disconnect. Only unregisters if `owner` is the current source, so a
   * late disconnect of a replaced breadcrumbs can't clear its successor's registration.
   */
  unregisterPromotedHeading(owner: object) {
    if (this.promotedOwner === owner) {
      this.promotedOwner = undefined;
      this.promoted = false;
      this._titleSuffixOffset = undefined;
      this.notify();
    }
  }

  /**
   * Inline offset, in px from the breadcrumbs' inline start, of the end of the promoted crumb.
   * Reported by breadcrumbs while promoted so `bit-header` can place `slot="title-suffix"` right
   * after the heading (Angular renders it into an outlet inside the breadcrumbs instead). While
   * unset, the suffix follows the breadcrumbs element.
   */
  get titleSuffixOffset(): number | undefined {
    return this._titleSuffixOffset;
  }
  private _titleSuffixOffset?: number;

  /** Width of the header's title suffix, so breadcrumbs can reserve room for it. Set by `bit-header`. */
  get titleSuffixWidth(): number {
    return this._titleSuffixWidth;
  }
  set titleSuffixWidth(value: number) {
    if (value !== this._titleSuffixWidth) {
      this._titleSuffixWidth = value;
      this.notify();
    }
  }
  private _titleSuffixWidth = 0;

  /** Called by breadcrumbs when the end of the promoted crumb moves; `undefined` to clear. */
  setTitleSuffixOffset(owner: object, offset: number | undefined) {
    if (this.promotedOwner === owner && offset !== this._titleSuffixOffset) {
      this._titleSuffixOffset = offset;
      this.notify();
    }
  }

  /** Registers a change listener. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const headerContext = createContext<HeaderContext>(Symbol("bit-header-context"));
