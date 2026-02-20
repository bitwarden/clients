import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  Directive,
  ElementRef,
  OnDestroy,
  ViewContainerRef,
  effect,
  inject,
  input,
  model,
} from "@angular/core";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { defaultPositions } from "./default-positions";
import { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

/**
 * Directive that anchors a popover to any element for programmatic control.
 * Ideal for guided tours, tooltips, and contextual help.
 * Use `[(popoverOpen)]` for two-way binding to control visibility.
 *
 * @example
 * Basic usage:
 * ```html
 * <div [bitPopoverAnchor]="tourStep" [(popoverOpen)]="showTour">
 *   Element to highlight
 * </div>
 * <bit-popover #tourStep>Tour content</bit-popover>
 * ```
 *
 * @example
 * With spotlight effect for guided tours:
 * ```html
 * <div [bitPopoverAnchor]="tourStep"
 *      [(popoverOpen)]="showTour"
 *      [spotlight]="true"
 *      [spotlightPadding]="12">
 *   Element to highlight
 * </div>
 * ```
 *
 * Use `PopoverTriggerForDirective` instead if the popover is meant to be manually opened by the user clicking a button.
 */
@Directive({
  selector: "[bitPopoverAnchor]",
  exportAs: "popoverAnchor",
})
export class PopoverAnchorDirective implements OnDestroy {
  /** Controls popover visibility. Supports two-way binding with `[(popoverOpen)]` */
  readonly popoverOpen = model(false);

  /** The popover component to display */
  readonly popover = input.required<PopoverComponent>({ alias: "bitPopoverAnchor" });

  /** Preferred popover position (e.g., "right-start", "below-center") */
  readonly position = input<string>();

  /** Enable spotlight effect that dims everything except the anchor element */
  readonly spotlight = input<boolean>(false);

  /** Padding around the spotlight cutout in pixels */
  readonly spotlightPadding = input<number>(0);

  private overlayRef: OverlayRef | null = null;
  private closedEventsSub: Subscription | null = null;
  private hasInitialized = false;
  private rafId1: number | null = null;
  private rafId2: number | null = null;
  private isDestroyed = false;
  private spotlightService = inject(SpotlightService);

  get positions() {
    if (!this.position()) {
      return defaultPositions;
    }

    const preferredPosition = defaultPositions.find((position) => position.id === this.position());

    if (preferredPosition) {
      return [preferredPosition, ...defaultPositions];
    }

    return defaultPositions;
  }

  get defaultPopoverConfig(): OverlayConfig {
    return {
      hasBackdrop: !this.spotlight(), // Spotlight manages its own backdrop
      backdropClass: "bit-popover-backdrop",
      scrollStrategy: this.spotlight()
        ? this.overlay.scrollStrategies.block()
        : this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.elementRef)
        .withPositions(this.positions)
        .withLockedPosition(true)
        .withFlexibleDimensions(false)
        .withPush(true),
    };
  }

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private viewContainerRef: ViewContainerRef,
    private overlay: Overlay,
  ) {
    effect(() => {
      if (this.isDestroyed) {
        return;
      }

      // Handle closing
      if (!this.popoverOpen() && this.overlayRef) {
        this.disposeAll();
        return;
      }

      // Handle opening
      if (!this.popoverOpen() || this.overlayRef) {
        return;
      }

      if (this.hasInitialized) {
        this.openPopover();
        return;
      }

      if (this.rafId1 !== null || this.rafId2 !== null) {
        return;
      }

      // Initial open - wait for layout to stabilize
      // First RAF: Waits for Angular's change detection to complete and queues the next paint
      this.rafId1 = requestAnimationFrame(() => {
        // Second RAF: Ensures the browser has actually painted that frame and all layout/position calculations are final
        this.rafId2 = requestAnimationFrame(() => {
          if (this.isDestroyed || !this.popoverOpen() || this.overlayRef) {
            return;
          }
          this.openPopover();
          this.hasInitialized = true;
          this.rafId2 = null;
        });
        this.rafId1 = null;
      });
    });
  }

  /** Programmatically opens the popover */
  openPopover() {
    if (this.overlayRef) {
      return;
    }

    // If spotlight is enabled, automatically close other spotlight popovers
    if (this.spotlight()) {
      this.spotlightService.register(this);
    }

    this.popoverOpen.set(true);
    this.overlayRef = this.overlay.create(this.defaultPopoverConfig);

    const templatePortal = new TemplatePortal(this.popover().templateRef(), this.viewContainerRef);

    this.overlayRef.attach(templatePortal);
    this.closedEventsSub = this.getClosedEvents().subscribe(() => {
      this.destroyPopover();
    });

    if (this.spotlight()) {
      this.spotlightService.showSpotlight(this.elementRef.nativeElement, this.spotlightPadding());
    }
  }

  private getClosedEvents(): Observable<any> {
    if (!this.overlayRef) {
      throw new Error("Overlay reference is not available");
    }

    const detachments = this.overlayRef.detachments();
    const escKey = this.overlayRef
      .keydownEvents()
      .pipe(filter((event: KeyboardEvent) => event.key === "Escape"));
    const backdrop = this.overlayRef.backdropClick().pipe(filter(() => !this.spotlight()));
    const popoverClosed = this.popover().closed;

    return detachments.pipe(mergeWith(escKey, backdrop, popoverClosed));
  }

  private destroyPopover() {
    if (!this.popoverOpen()) {
      return;
    }

    this.popoverOpen.set(false);

    // Unregister from spotlight
    if (this.spotlight()) {
      this.spotlightService.unregister(this);
    }

    this.disposeAll();
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.closedEventsSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;

    if (this.rafId1 !== null) {
      cancelAnimationFrame(this.rafId1);
      this.rafId1 = null;
    }
    if (this.rafId2 !== null) {
      cancelAnimationFrame(this.rafId2);
      this.rafId2 = null;
    }

    if (this.spotlight()) {
      this.spotlightService.hideSpotlight();
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.disposeAll();
  }

  /** Programmatically closes the popover */
  closePopover() {
    this.destroyPopover();
  }
}
