import { hasModifierKey } from "@angular/cdk/keycodes";
import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  Directive,
  ElementRef,
  OnDestroy,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  signal,
} from "@angular/core";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { PositionIdentifier, defaultPositions } from "./default-positions";
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
 * <div [bitPopoverAnchorFor]="tourStep" [(popoverOpen)]="showTour">
 *   Element to highlight
 * </div>
 * <bit-popover #tourStep>Tour content</bit-popover>
 * ```
 *
 * @example
 * With spotlight effect for guided tours:
 * ```html
 * <div [bitPopoverAnchorFor]="tourStep"
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
  selector: "[bitPopoverAnchorFor]",
  exportAs: "popoverAnchor",
})
export class PopoverAnchorForDirective implements OnDestroy {
  /** Controls popover visibility. Supports two-way binding with `[(popoverOpen)]` */
  readonly popoverOpen = model(false);

  /** The popover component to display */
  readonly popover = input.required<PopoverComponent>({ alias: "bitPopoverAnchorFor" });

  /** Preferred popover position (e.g., "right-start", "below-center") */
  readonly position = input<PositionIdentifier>();

  /** Enable spotlight effect that dims everything except the anchor element */
  readonly spotlight = input<boolean>(false);

  /** Padding around the spotlight cutout in pixels */
  readonly spotlightPadding = input<number>(0);

  private overlayRef: OverlayRef | null = null;
  private closedEventsSub: Subscription | null = null;
  private readonly hasInitialized = signal(false);
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
      backdropClass: "cdk-overlay-transparent-backdrop",
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(
          this.spotlight() && this.spotlightService.overlayElement
            ? new ElementRef(this.spotlightService.overlayElement)
            : this.elementRef,
        )
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
    // Wait for the first render to complete so layout is stable before opening.
    // Sets a signal so the effect below re-evaluates once the layout is ready.
    afterNextRender(() => this.hasInitialized.set(true));

    effect(() => {
      if (this.isDestroyed) {
        return;
      }

      // Handle closing
      if (!this.popoverOpen() && this.overlayRef) {
        this.disposeAll();
        return;
      }

      // Handle opening — hasInitialized() ensures layout is stable on first open
      if (!this.popoverOpen() || this.overlayRef || !this.hasInitialized()) {
        return;
      }

      this.openPopover();
    });
  }

  /** Programmatically opens the popover */
  openPopover() {
    if (this.overlayRef) {
      return;
    }

    // Create the spotlight border overlay first so the popover overlay sits above it in DOM order
    if (this.spotlight()) {
      this.spotlightService.register(this);
      this.spotlightService.showSpotlight(this.elementRef.nativeElement, this.spotlightPadding());
    }

    this.popoverOpen.set(true);
    this.overlayRef = this.overlay.create(this.defaultPopoverConfig);

    const templatePortal = new TemplatePortal(this.popover().templateRef(), this.viewContainerRef);

    this.overlayRef.attach(templatePortal);
    this.closedEventsSub = this.getClosedEvents().subscribe((event) => {
      // Closing the popover is handled in this.destroyPopover, so we want to prevent the escape
      // key from doing its normal default action, which would otherwise cause a parent component
      // (like a dialog) or extension window to close
      if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
        event.preventDefault();
      }
      this.destroyPopover();
    });
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
    this.disposeAll();
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.closedEventsSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;

    if (this.spotlight()) {
      this.spotlightService.unregister(this);
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
