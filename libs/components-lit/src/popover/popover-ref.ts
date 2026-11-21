import { captureFocus, trapFocus } from "../core/focus";
import { registerOverlay } from "../core/overlay";
import { autoUpdate } from "../core/position";

import type { BitPopoverBase } from "./popover-base";
import { PopoverPosition, popoverPositionsFor, positionPopover } from "./popover-position";
import { spotlight } from "./spotlight";

/** An element, or a getter for one that may not exist yet (e.g. inside a dialog still opening). */
export type PopoverAnchor = HTMLElement | null | undefined | (() => HTMLElement | null | undefined);

export type PopoverOptions = {
  /** Preferred position; the default list is tried after it. */
  position?: PopoverPosition;
  /** Dim everything except the anchor. Spotlight popovers ignore Escape and outside clicks. */
  spotlight?: boolean;
  /** Close when clicking outside. Defaults to true. */
  closeOnBackdropClick?: boolean;
};

/** A popover opened with `openPopover`. */
export class PopoverRef {
  private isClosed = false;
  private resolveClosed!: () => void;

  /** Resolves once on close: the close button, Escape, an outside click, or `close()`. */
  readonly closed = new Promise<void>((resolve) => (this.resolveClosed = resolve));

  /** @internal */
  constructor(private readonly dispose: () => void) {}

  get isOpen() {
    return !this.isClosed;
  }

  close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.dispose();
    this.resolveClosed();
  }
}

function resolveAnchor(anchor: PopoverAnchor): HTMLElement | undefined {
  const el = typeof anchor === "function" ? anchor() : anchor;
  return el?.isConnected ? el : undefined;
}

/** Finite animations running on the element or its ancestors, e.g. a dialog sliding in. */
function runningAnimations(element: HTMLElement): Animation[] {
  return document.getAnimations().filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    return (
      target instanceof Element &&
      (target === element || target.contains(element) || target.shadowRoot?.contains(element)) &&
      animation.effect?.getComputedTiming().endTime !== Infinity
    );
  });
}

/**
 * Opens `popover` next to `anchor`, replacing Angular's `PopoverService.open`. The popover waits
 * for its anchor to render and finish animating in, hides while the anchor is gone, and reattaches
 * when it returns. It closes when the popover element is removed from the document.
 *
 * ```ts
 * const ref = openPopover(this.coachmark, () => this.toolbar.filterButton, { spotlight: true });
 * await ref.closed;
 * ```
 */
export function openPopover(
  popover: BitPopoverBase,
  anchor: PopoverAnchor,
  options: PopoverOptions = {},
): PopoverRef {
  const { spotlight: useSpotlight = false, closeOnBackdropClick = true } = options;
  let frame = 0;
  let candidate: HTMLElement | undefined;
  let settled: HTMLElement | undefined;
  let attachedTo: HTMLElement | undefined;
  let cleanups: (() => void)[] = [];

  const detach = () => {
    if (!attachedTo) {
      return;
    }
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    attachedTo = undefined;
  };

  const ref = new PopoverRef(() => {
    cancelAnimationFrame(frame);
    detach();
    if (popover._isActiveRef(ref)) {
      popover._setActiveRef(undefined);
    }
  });

  const attach = (element: HTMLElement) => {
    attachedTo = element;
    const restoreFocus = captureFocus();
    if (useSpotlight) {
      spotlight.register(ref);
      spotlight.show(element);
    }

    popover._showPanel({
      backdrop: !useSpotlight,
      onBackdropClick: () => closeOnBackdropClick && ref.close(),
    });

    const floating = popover._floating;
    const positionTarget = (useSpotlight && spotlight.overlayElement) || element;
    // Like the CDK's locked position: keep the first placement while scrolling, re-pick on resize.
    let locked: PopoverPosition | undefined;
    const update = () => {
      locked = positionPopover(
        positionTarget,
        floating,
        locked ? [locked] : popoverPositionsFor(options.position),
      );
      popover._setPosition(locked);
    };
    const unlock = () => (locked = undefined);
    window.addEventListener("resize", unlock);
    const stopAutoUpdate = autoUpdate(positionTarget, floating, update);
    const stopFollowingSpotlight = useSpotlight ? spotlight.onMoved(update) : undefined;

    const unregister = registerOverlay({
      onKeydown: (event) => {
        if (event.key === "Escape") {
          // Keeps Escape from also closing a parent, like a dialog or the extension window.
          event.preventDefault();
          if (!useSpotlight) {
            ref.close();
          }
        }
        return true;
      },
    });

    const onClosedEvent = () => ref.close();
    popover.addEventListener("closed", onClosedEvent);

    const untrap = trapFocus(popover._focusContainer);
    void popover.updateComplete.then(() => {
      if (attachedTo === element) {
        popover._focusInitial();
      }
    });

    cleanups = [
      untrap,
      () => popover.removeEventListener("closed", onClosedEvent),
      unregister,
      () => stopFollowingSpotlight?.(),
      stopAutoUpdate,
      () => window.removeEventListener("resize", unlock),
      () => popover._hidePanel(),
      () => {
        if (useSpotlight) {
          spotlight.unregister(ref);
          spotlight.hide();
        }
      },
      restoreFocus,
    ];
  };

  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!popover.isConnected) {
      ref.close();
      return;
    }
    if (!popover.hasUpdated) {
      return;
    }
    const target = resolveAnchor(anchor);
    if (target !== candidate) {
      candidate = target;
      // Measuring an anchor mid-animation would pin the popover to where it started.
      const running = target ? runningAnimations(target) : [];
      if (running.length) {
        settled = undefined;
        void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
          if (candidate === target) {
            settled = target;
          }
        });
      } else {
        settled = target;
      }
    }
    // Losing the anchor detaches without closing, so the popover returns with it.
    if (settled !== attachedTo) {
      detach();
      if (settled) {
        attach(settled);
      }
    }
  };

  popover._setActiveRef(ref);
  tick();
  return ref;
}
