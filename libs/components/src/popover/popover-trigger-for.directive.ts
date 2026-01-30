import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewContainerRef,
  effect,
  input,
  model,
} from "@angular/core";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { defaultPositions } from "./default-positions";
import { PopoverComponent } from "./popover.component";

@Directive({
  selector: "[bitPopoverTriggerFor]",
  exportAs: "popoverTrigger",
  host: {
    "[attr.aria-expanded]": "this.popoverOpen()",
  },
})
export class PopoverTriggerForDirective implements OnDestroy {
  readonly popoverOpen = model(false);

  readonly popover = input.required<PopoverComponent>({ alias: "bitPopoverTriggerFor" });

  readonly position = input<string>();

  private overlayRef: OverlayRef | null = null;
  private closedEventsSub: Subscription | null = null;
  private hasInitialized = false;
  private rafId1: number | null = null;
  private rafId2: number | null = null;
  private isDestroyed = false;

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
      hasBackdrop: true,
      backdropClass: "cdk-overlay-transparent-backdrop",
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
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
      if (this.isDestroyed || !this.popoverOpen() || this.overlayRef) {
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

  @HostListener("click")
  togglePopover() {
    if (this.isDestroyed) {
      return;
    }

    if (this.popoverOpen()) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  private openPopover() {
    if (this.overlayRef) {
      return;
    }

    this.popoverOpen.set(true);
    this.overlayRef = this.overlay.create(this.defaultPopoverConfig);

    const templatePortal = new TemplatePortal(this.popover().templateRef(), this.viewContainerRef);

    this.overlayRef.attach(templatePortal);
    this.closedEventsSub = this.getClosedEvents().subscribe(() => {
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
    const backdrop = this.overlayRef.backdropClick();
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

    if (this.rafId1 !== null) {
      cancelAnimationFrame(this.rafId1);
      this.rafId1 = null;
    }
    if (this.rafId2 !== null) {
      cancelAnimationFrame(this.rafId2);
      this.rafId2 = null;
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.disposeAll();
  }

  closePopover() {
    this.destroyPopover();
  }
}
