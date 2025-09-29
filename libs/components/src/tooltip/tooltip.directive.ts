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
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import {
  getDefaultPositions,
  ALLOWED_TOOLTIP_POSITION_IDS,
  AllowedTooltipPosition,
} from "../utils/overlay-positions";

import { TooltipComponent, TOOLTIP_DATA } from "./tooltip.component";

@Directive({
  selector: "[bitTooltip]",
  standalone: true,
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
   * The value of this input is forwarded to the tooltip.component to set it's position explicitly.
   * @default "above-center"
   */
  readonly tooltipPosition = input<AllowedTooltipPosition>("above-center");

  private _tooltipPosition = signal<AllowedTooltipPosition>(this.tooltipPosition());
  private isVisible = signal(false);
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
            tooltipPosition: this._tooltipPosition,
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
      const connectionPair = change.connectionPair as ConnectionPositionPair & {
        id: AllowedTooltipPosition;
      };

      this._tooltipPosition.set(connectionPair.id);
    });
  }

  ngOnInit() {
    this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));

    this.overlayRef = this.overlay.create({
      ...this.defaultPopoverConfig,
      positionStrategy: this.positionStrategy,
    });

    this.tooltipRef = this.overlayRef.attach(this.tooltipPortal);

    effect(
      () => {
        this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));
        this.overlayRef?.updatePosition();
      },
      { injector: this.injector },
    );
  }
}
