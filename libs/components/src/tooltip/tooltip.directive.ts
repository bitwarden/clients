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

import { TooltipPosition, TooltipPositionIdentifier, tooltipPositions } from "./tooltip-positions";
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
  readonly tooltipPosition = input<TooltipPositionIdentifier>("above-center");

  private _tooltipPosition = signal<TooltipPositionIdentifier>(this.tooltipPosition());
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

  constructor() {
    this.positionStrategy.positionChanges.pipe(takeUntilDestroyed()).subscribe((change) => {
      const connectionPair = change.connectionPair as ConnectionPositionPair & {
        id: TooltipPosition["id"];
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
