import { getOverlayRoot, popoverResetCss } from "../core/overlay";

/** Anything the spotlight can close when a different spotlight popover opens. */
export type SpotlightOwner = { close(): void };

const PADDING_PX = 8;
const HIDE_DELAY_MS = 100;

/**
 * Dims the page except for one target, with a ring around it. Coordinates spotlight popovers so
 * only one is open at a time and transitions between targets without flicker.
 */
class Spotlight {
  private ring?: HTMLElement;
  private backdrop?: HTMLElement;
  private currentTarget: HTMLElement | null = null;
  private activeOwner: SpotlightOwner | null = null;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private lastRect: DOMRect | null = null;
  private resizeObserver?: ResizeObserver;
  private readonly movedListeners = new Set<() => void>();

  /** The ring element while a spotlight is shown; spotlight popovers anchor to its outer edge. */
  get overlayElement(): HTMLElement | null {
    return this.currentTarget ? (this.ring ?? null) : null;
  }

  /**
   * Shows the spotlight on `target`, or moves it there. A `data-spotlight-host` target redirects
   * the ring to its `[data-spotlight-target]` descendant.
   */
  show(target: HTMLElement) {
    const resolved =
      (target.hasAttribute("data-spotlight-host")
        ? target.querySelector<HTMLElement>("[data-spotlight-target]")
        : null) ?? target;

    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.currentTarget === resolved) {
      return;
    }
    this.currentTarget = resolved;
    resolved.scrollIntoView?.({ block: "center", inline: "nearest" });
    this.teardown();
    this.create(resolved);
  }

  /** Hides after a short delay, so moving between targets doesn't flash the page. */
  hide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.teardown();
      this.currentTarget = null;
      this.hideTimer = undefined;
    }, HIDE_DELAY_MS);
  }

  /** Makes `owner` the active spotlight popover, closing any other. */
  register(owner: SpotlightOwner) {
    if (this.activeOwner && this.activeOwner !== owner) {
      this.activeOwner.close();
    }
    this.activeOwner = owner;
  }

  unregister(owner: SpotlightOwner) {
    if (this.activeOwner === owner) {
      this.activeOwner = null;
    }
  }

  /** Runs `listener` after the ring follows its target. Returns an unsubscribe function. */
  onMoved(listener: () => void): () => void {
    this.movedListeners.add(listener);
    return () => this.movedListeners.delete(listener);
  }

  /** Re-measures the target and moves the ring. */
  refresh() {
    const target = this.currentTarget;
    const ring = this.ring;
    if (!target || !ring) {
      return;
    }
    const rect = target.getBoundingClientRect();
    this.lastRect = rect;
    Object.assign(ring.style, {
      left: `${rect.left - PADDING_PX}px`,
      top: `${rect.top - PADDING_PX}px`,
      width: `${rect.width + PADDING_PX * 2}px`,
      height: `${rect.height + PADDING_PX * 2}px`,
    });
    this.movedListeners.forEach((listener) => listener());
  }

  private create(target: HTMLElement) {
    if (!this.ring || !this.backdrop) {
      // Blocks clicks on the page, including any dialog underneath; spotlight popovers don't close
      // on outside clicks.
      this.backdrop = document.createElement("div");
      this.backdrop.setAttribute("popover", "manual");
      this.backdrop.setAttribute("data-spotlight-backdrop", "");
      this.backdrop.style.cssText = `${popoverResetCss} inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none;`;

      this.ring = document.createElement("div");
      this.ring.setAttribute("popover", "manual");
      this.ring.setAttribute("data-spotlight-border", "");
      this.ring.style.cssText = `${popoverResetCss}
        box-sizing: border-box;
        box-shadow: 0 0 0 9999px var(--color-bg-overlay);
        border: 2px solid var(--color-border-accent-primary);
        pointer-events: none;`;
    }

    const radius = parseFloat(getComputedStyle(target).borderRadius) || 0;
    this.ring.style.borderRadius = `${radius + PADDING_PX}px`;

    const root = getOverlayRoot();
    root.append(this.backdrop, this.ring);
    this.backdrop.showPopover();
    this.ring.showPopover();
    this.refresh();

    this.resizeObserver = new ResizeObserver(() => this.refresh());
    this.resizeObserver.observe(target);
    window.addEventListener("resize", this.onWindowChange);
    window.addEventListener("scroll", this.onWindowChange, { capture: true, passive: true });
    this.watchRect();
  }

  private onWindowChange = () => this.refresh();

  /** Layout shifts move the target without resizing it, so its rect is checked every frame. */
  private watchRect() {
    this.frame = requestAnimationFrame(() => {
      const rect = this.currentTarget?.getBoundingClientRect();
      const last = this.lastRect;
      if (
        rect &&
        last &&
        (rect.left !== last.left ||
          rect.top !== last.top ||
          rect.width !== last.width ||
          rect.height !== last.height)
      ) {
        this.refresh();
      }
      this.watchRect();
    });
  }

  private teardown() {
    cancelAnimationFrame(this.frame);
    this.lastRect = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener("resize", this.onWindowChange);
    window.removeEventListener("scroll", this.onWindowChange, { capture: true });
    for (const el of [this.ring, this.backdrop]) {
      if (el?.matches(":popover-open")) {
        el.hidePopover();
      }
      el?.remove();
    }
  }
}

/** Shared spotlight, replacing Angular's `SpotlightService`. */
export const spotlight = new Spotlight();
