import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import {
  Directive,
  ViewContainerRef,
  inject,
  OnInit,
  ElementRef,
  Injector,
  input,
  effect,
  signal,
} from "@angular/core";

import { TooltipPositionIdentifier, tooltipPositions } from "./tooltip-positions";
import { TooltipComponent, TOOLTIP_DATA } from "./tooltip.component";

/**
 * Directive to add a tooltip to any element. The tooltip content is provided via the `bitTooltip` input.
 * The position of the tooltip can be set via the `tooltipPosition` input. Default position is "above-center".
 */
@Directive({
  selector: "[bitTooltip]",
  host: {
    "(mouseenter)": "showTooltip()",
    "(mouseleave)": "hideTooltip()",
    "(focus)": "showTooltip()",
    "(blur)": "hideTooltip()",
  },
})
export class TooltipDirective implements OnInit {
  /**
   * The value of this input is forwarded to the tooltip.component to render
   */
  readonly bitTooltip = input.required<string>();
  /**
   * The value of this input is forwarded to the tooltip.component to set its position explicitly.
   * @default "above-center"
   */
  readonly tooltipPosition = input<TooltipPositionIdentifier>("above-center");

  private isVisible = signal(false);
  private overlayRef: OverlayRef | undefined;
  private elementRef = inject(ElementRef);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);
  private positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo(this.elementRef)
    .withFlexibleDimensions(false)
    .withPush(true);

  private tooltipPortal = new ComponentPortal(
    TooltipComponent,
    this.viewContainerRef,
    Injector.create({
      providers: [
        {
          provide: TOOLTIP_DATA,
          useValue: {
            content: this.bitTooltip,
            isVisible: this.isVisible,
            tooltipPosition: this.tooltipPosition,
          },
        },
      ],
    }),
  );

  private showTooltip = () => {
    this.isVisible.set(true);
  };

  private hideTooltip = () => {
    this.isVisible.set(false);
  };

  private computePositions(tooltipPosition: TooltipPositionIdentifier) {
    const chosenPosition = tooltipPositions.find((position) => position.id === tooltipPosition);

    return chosenPosition ? [chosenPosition, ...tooltipPositions] : tooltipPositions;
  }

  get defaultPopoverConfig(): OverlayConfig {
    return {
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    };
  }

  ngOnInit() {
    this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));

    this.overlayRef = this.overlay.create({
      ...this.defaultPopoverConfig,
      positionStrategy: this.positionStrategy,
    });

    this.overlayRef.attach(this.tooltipPortal);

    effect(
      () => {
        this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));
        this.overlayRef?.updatePosition();
      },
      { injector: this.injector },
    );
  }
}
