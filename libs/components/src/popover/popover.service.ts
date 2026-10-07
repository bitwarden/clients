import { hasModifierKey } from "@angular/cdk/keycodes";
import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  Signal,
  ViewContainerRef,
  computed,
  effect,
  inject,
  isSignal,
  signal,
  untracked,
} from "@angular/core";
import { outputToObservable } from "@angular/core/rxjs-interop";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { PositionIdentifier, defaultPositions } from "./default-positions";
import { PopoverPanelComponent } from "./popover-panel.component";
import { PopoverRef } from "./popover-ref";
import type { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

type PopoverAnchorElement = HTMLElement | ElementRef<HTMLElement> | null | undefined;

/** An element, or a signal of one such as a public `viewChild`. `undefined` while not rendered. */
export type PopoverAnchorRef = PopoverAnchorElement | Signal<PopoverAnchorElement>;

export interface PopoverOptions {
  /** Preferred position, e.g. "below-center". */
  position?: PositionIdentifier;
  /** Dim everything except the anchor. Defaults to false. */
  spotlight?: boolean;
  /** Whether clicking the backdrop closes the popover. Defaults to true. */
  closeOnBackdropClick?: boolean;
  /** Where the content renders in the component tree. Defaults to the popover's own location. */
  viewContainerRef?: ViewContainerRef;
}

/** Reads an anchor ref, tracking it when it's a signal. */
export function resolveAnchor(anchor: PopoverAnchorRef): HTMLElement | undefined {
  const value = isSignal(anchor) ? anchor() : anchor;
  return (value instanceof ElementRef ? value.nativeElement : value) ?? undefined;
}

/** Finite animations running on the element or its ancestors, e.g. a dialog sliding in. */
function runningAnimations(element: HTMLElement): Animation[] {
  // `getAnimations` is missing in jsdom
  return (document.getAnimations?.() ?? []).filter((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    return effect?.target?.contains(element) && effect.getComputedTiming().endTime !== Infinity;
  });
}

/**
 * Opens popovers from code. The popover waits for its anchor to render and finish animating in,
 * hides while the anchor is gone, and reattaches when it returns.
 *
 * @example
 * ```ts
 * private readonly toolbar = viewChild.required(BitTableToolbarComponent);
 * private readonly filtersPopover = viewChild.required<PopoverComponent>("filtersPopover");
 *
 * const ref = this.popoverService.open(this.filtersPopover(), this.toolbar().filterButton, {
 *   spotlight: true,
 * });
 * ```
 */
@Injectable({ providedIn: "root" })
export class PopoverService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly spotlightService = inject(SpotlightService);

  open(
    popover: PopoverComponent | PopoverPanelComponent,
    anchor: PopoverAnchorRef,
    options: PopoverOptions = {},
  ): PopoverRef {
    // Callable from an effect, which can't create effects of its own
    return untracked(() => this.create(popover, anchor, options));
  }

  private overlayConfig(
    anchor: HTMLElement,
    { position, spotlight = false }: PopoverOptions,
  ): OverlayConfig {
    const spotlightElement = spotlight ? this.spotlightService.overlayElement : null;
    const preferred = defaultPositions.find((candidate) => candidate.id === position);
    return {
      hasBackdrop: !spotlight, // Spotlight manages its own backdrop
      backdropClass: "cdk-overlay-transparent-backdrop",
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(spotlightElement ?? anchor)
        .withPositions(preferred ? [preferred, ...defaultPositions] : defaultPositions)
        .withLockedPosition(true)
        .withFlexibleDimensions(false)
        .withPush(true),
    };
  }

  private create(
    popover: PopoverComponent | PopoverPanelComponent,
    anchor: PopoverAnchorRef,
    options: PopoverOptions,
  ): PopoverRef {
    const { spotlight = false, closeOnBackdropClick = true } = options;
    const viewContainerRef = options.viewContainerRef ?? popover.viewContainerRef;

    let overlayRef: OverlayRef | null = null;
    let closeEvents: Subscription | null = null;
    let attachedTo: HTMLElement | undefined;

    const ref = new PopoverRef(() => {
      settleEffect.destroy();
      attachEffect.destroy();
      stopOnDestroy();
      detach();
    });

    const target = computed(() => resolveAnchor(anchor));
    /** `target` once it has finished animating into place. */
    const settled = signal<HTMLElement | undefined>(undefined);

    const attach = (element: HTMLElement) => {
      // Create the spotlight border overlay first so the popover overlay sits above it in DOM order
      if (spotlight) {
        this.spotlightService.register(ref);
        this.spotlightService.showSpotlight(element);
      }
      attachedTo = element;
      overlayRef = this.overlay.create(this.overlayConfig(element, options));
      overlayRef.attach(new TemplatePortal(popover.templateRef(), viewContainerRef));
      closeEvents = this.closeEvents(
        overlayRef,
        popover,
        spotlight,
        closeOnBackdropClick,
      ).subscribe((event) => {
        // Keeps Escape from also closing a parent, like a dialog or the extension window
        if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
          event.preventDefault();
        }
        ref.close();
      });
    };

    const detach = () => {
      if (!overlayRef) {
        return;
      }
      // Unsubscribe first, so the detachment doesn't read as a close
      closeEvents?.unsubscribe();
      closeEvents = null;
      overlayRef.dispose();
      overlayRef = null;
      attachedTo = undefined;
      if (spotlight) {
        this.spotlightService.unregister(ref);
        this.spotlightService.hideSpotlight();
      }
    };

    // Measuring an anchor mid-animation would pin the popover to where it started
    const settleEffect = effect(
      () => {
        const element = target();
        const running = element ? runningAnimations(element) : [];
        if (!running.length) {
          settled.set(element);
          return;
        }
        settled.set(undefined);
        void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
          if (target() === element) {
            settled.set(element);
          }
        });
      },
      { injector: this.injector },
    );

    // Losing the anchor detaches without closing, so the popover returns with it
    const attachEffect = effect(
      () => {
        const element = settled();
        untracked(() => {
          if (element === attachedTo) {
            return;
          }
          detach();
          if (element) {
            attach(element);
          }
        });
      },
      { injector: this.injector },
    );

    const stopOnDestroy = viewContainerRef.injector.get(DestroyRef).onDestroy(() => ref.close());

    return ref;
  }

  private closeEvents(
    overlayRef: OverlayRef,
    popover: PopoverComponent | PopoverPanelComponent,
    spotlight: boolean,
    closeOnBackdropClick: boolean,
  ): Observable<unknown> {
    const escKey = overlayRef
      .keydownEvents()
      .pipe(filter((event) => event.key === "Escape" && !spotlight));
    const backdrop = overlayRef
      .backdropClick()
      .pipe(filter(() => !spotlight && closeOnBackdropClick));
    const popoverClosed = outputToObservable(popover.closed);

    return overlayRef.detachments().pipe(mergeWith(escKey, backdrop, popoverClosed));
  }
}
