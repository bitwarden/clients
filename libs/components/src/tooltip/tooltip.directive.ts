import {
  ConnectedOverlayPositionChange,
  ConnectionPositionPair,
  Overlay,
  OverlayConfig,
  OverlayRef,
} from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import {
  Directive,
  ViewContainerRef,
  inject,
  OnInit,
  ElementRef,
  HostListener,
  ComponentRef,
  Injector,
  input,
  effect,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { defaultPositions } from "../popover/default-positions";

import { TooltipComponent } from "./tooltip.component";

@Directive({
  selector: "[bitTooltip]",
  standalone: true,
})
export class TooltipDirective implements OnInit {
  readonly bitTooltip = input.required<string>();
  readonly tooltipPosition = input("above-center");

  private overlayRef: OverlayRef;
  private elementRef = inject(ElementRef);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);
  private tooltipRef: ComponentRef<TooltipComponent>;
  private positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo(this.elementRef)
    .withFlexibleDimensions(false)
    .withPush(true);

  tooltipPortal = new ComponentPortal(TooltipComponent, this.viewContainerRef, this.injector);

  private showTooltip = () => {
    this.tooltipRef.setInput("isVisible", true);
  };

  private hideTooltip = () => {
    this.tooltipRef.setInput("isVisible", false);
  };

  @HostListener("mouseenter")
  @HostListener("focus")
  show() {
    this.showTooltip();
  }

  @HostListener("mouseleave")
  @HostListener("blur")
  hide() {
    this.hideTooltip();
  }

  private computePositions(pref: string) {
    const allowedPositions = defaultPositions.filter(
      (p) =>
        p.id === "left-center" ||
        p.id === "right-center" ||
        p.id === "above-center" ||
        p.id === "below-center",
    );
    const chosenPosition = allowedPositions.find((p) => p.id === pref);
    return chosenPosition ? [chosenPosition, ...allowedPositions] : allowedPositions;
  }

  get positions() {
    if (!this.tooltipPosition()) {
      return defaultPositions;
    }

    const preferredPosition = defaultPositions.find(
      (position) => position.id === this.tooltipPosition(),
    );

    if (preferredPosition) {
      return [preferredPosition, ...defaultPositions];
    }

    return defaultPositions;
  }

  get defaultPopoverConfig(): OverlayConfig {
    return {
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    };
  }

  constructor() {
    this.positionStrategy.positionChanges.pipe(takeUntilDestroyed()).subscribe(
      (
        change: ConnectedOverlayPositionChange & {
          connectionPair: ConnectionPositionPair & { id: string };
        },
      ) => {
        this.tooltipRef?.setInput("tooltipPosition", change.connectionPair.id);
      },
    );
  }

  ngOnInit() {
    this.positionStrategy.withPositions(this.computePositions("above-center"));

    this.overlayRef = this.overlay.create({
      ...this.defaultPopoverConfig,
      positionStrategy: this.positionStrategy,
    });

    this.tooltipRef = this.overlayRef.attach(this.tooltipPortal);
    this.tooltipRef.setInput("content", this.bitTooltip());

    effect(
      () => {
        const preferredPosition = this.tooltipPosition();
        const positions = this.computePositions(preferredPosition);
        this.positionStrategy.withPositions(positions);
        this.overlayRef.updatePosition();
        this.tooltipRef.setInput("tooltipPosition", preferredPosition);
      },
      { injector: this.injector },
    );

    this.tooltipRef.setInput("tooltipPosition", this.tooltipPosition());
  }
}
