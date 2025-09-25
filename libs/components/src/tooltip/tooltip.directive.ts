import { ConnectionPositionPair, Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import {
  Directive,
  ViewContainerRef,
  inject,
  OnInit,
  ElementRef,
  ComponentRef,
  Injector,
  input,
  effect,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import {
  getDefaultPositions,
  ALLOWED_TOOLTIP_POSITION_IDS,
  AllowedTooltipPosition,
} from "../utils/overlay-positions";

import { TooltipComponent } from "./tooltip.component";

@Directive({
  selector: "[bitTooltip]",
  standalone: true,
  host: {
    "(mouseenter)": "show()",
    "(mouseleave)": "hide()",
    "(focus)": "show()",
    "(blur)": "hide()",
  },
})
export class TooltipDirective implements OnInit {
  /**
   * The value of this input is forwarded to the tooltip.component to render
   */
  readonly bitTooltip = input.required<string>();
  /**
   * The value of this input is forwarded to the tooltip.component to set it's position explicitly.
   * @default "above-center"
   */
  readonly tooltipPosition = input<AllowedTooltipPosition>("above-center");

  private overlayRef: OverlayRef | undefined;
  private elementRef = inject(ElementRef);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);
  private tooltipRef: ComponentRef<TooltipComponent> | undefined;
  private positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo(this.elementRef)
    .withFlexibleDimensions(false)
    .withPush(true);

  tooltipPortal = new ComponentPortal(TooltipComponent, this.viewContainerRef, this.injector);

  private showTooltip = () => {
    this.tooltipRef?.setInput("isVisible", true);
  };

  private hideTooltip = () => {
    this.tooltipRef?.setInput("isVisible", false);
  };

  show() {
    this.showTooltip();
  }

  hide() {
    this.hideTooltip();
  }

  private computePositions(tooltipPosition: AllowedTooltipPosition) {
    const allowedPositions = getDefaultPositions({
      classNamePrefix: "bit-tooltip",
      originOffset: 10,
      positionSubset: ALLOWED_TOOLTIP_POSITION_IDS,
    });

    const chosenPosition = allowedPositions.find((position) => position.id === tooltipPosition);

    return chosenPosition ? [chosenPosition, ...allowedPositions] : allowedPositions;
  }

  get defaultPopoverConfig(): OverlayConfig {
    return {
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    };
  }

  constructor() {
    this.positionStrategy.positionChanges.pipe(takeUntilDestroyed()).subscribe((change) => {
      const connectionPair = change.connectionPair as ConnectionPositionPair & { id: string };

      this.tooltipRef?.setInput("tooltipPosition", connectionPair.id);
    });
  }

  ngOnInit() {
    this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));

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
        this.overlayRef?.updatePosition();
        this.tooltipRef?.setInput("tooltipPosition", preferredPosition);
      },
      { injector: this.injector },
    );

    this.tooltipRef.setInput("tooltipPosition", this.tooltipPosition());
  }
}
