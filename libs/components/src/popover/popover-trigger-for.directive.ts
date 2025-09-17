import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewContainerRef,
  input,
  model,
} from "@angular/core";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { getDefaultPositions } from "../utils/default-positions";

import { PopoverComponent } from "./popover.component";

@Directive({
  selector: "[bitPopoverTriggerFor]",
  exportAs: "popoverTrigger",
  host: {
    "[attr.aria-expanded]": "this.popoverOpen()",
  },
})
export class PopoverTriggerForDirective implements OnDestroy, AfterViewInit {
  readonly popoverOpen = model(false);

  readonly popover = input.required<PopoverComponent>({ alias: "bitPopoverTriggerFor" });

  readonly position = input<string>();

  private overlayRef: OverlayRef | null = null;
  private closedEventsSub: Subscription | null = null;

  get positions() {
    const defaultPositions = getDefaultPositions("bit-popover");
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
  ) {}

  @HostListener("click")
  togglePopover() {
    if (this.popoverOpen()) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  private openPopover() {
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
    if (!this.overlayRef || !this.popoverOpen()) {
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
  }

  ngAfterViewInit() {
    if (this.popoverOpen()) {
      this.openPopover();
    }
  }

  ngOnDestroy() {
    this.disposeAll();
  }

  closePopover() {
    this.destroyPopover();
  }
}
