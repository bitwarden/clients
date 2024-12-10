// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  ViewContainerRef,
} from "@angular/core";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { defaultPositions } from "./default-positions";
import { PopoverComponent } from "./popover.component";

@Directive({
  selector: "[bitPopoverTriggerFor]",
  standalone: true,
  exportAs: "popoverTrigger",
})
export class PopoverTriggerForDirective implements OnDestroy, AfterViewInit {
  @Input()
  @HostBinding("attr.aria-expanded")
  popoverOpen = false;

  @Input("bitPopoverTriggerFor")
  popover: PopoverComponent;

  @Input("position")
  position: string;

  private overlayRef: OverlayRef;
  private closedEventsSub: Subscription;

  get positions() {
    if (!this.position) {
      return defaultPositions;
    }

    const preferredPosition = defaultPositions.find((position) => position.id === this.position);

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
    if (this.popoverOpen) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  private openPopover() {
    this.popoverOpen = true;
    this.overlayRef = this.overlay.create(this.defaultPopoverConfig);

    const templatePortal = new TemplatePortal(this.popover.templateRef, this.viewContainerRef);

    this.overlayRef.attach(templatePortal);
    this.closedEventsSub = this.getClosedEvents().subscribe(() => {
      this.destroyPopover();
    });
  }

  private getClosedEvents(): Observable<any> {
    const detachments = this.overlayRef.detachments();
    const escKey = this.overlayRef
      .keydownEvents()
      .pipe(filter((event: KeyboardEvent) => event.key === "Escape"));
    const backdrop = this.overlayRef.backdropClick();
    const popoverClosed = this.popover.closed;

    return detachments.pipe(mergeWith(escKey, backdrop, popoverClosed));
  }

  private destroyPopover() {
    if (this.overlayRef == null || !this.popoverOpen) {
      return;
    }

    this.popoverOpen = false;
    this.disposeAll();
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.overlayRef?.dispose();
  }

  ngAfterViewInit() {
    if (this.popoverOpen) {
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
