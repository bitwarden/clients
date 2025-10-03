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
  signal,
  computed,
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
  readonly bitTooltip = input<string>();
  /**
   * The value of this input is forwarded to the tooltip.component to set its position explicitly.
   * @default "above-center"
   */
  readonly tooltipPosition = input<TooltipPositionIdentifier>("above-center");

  readonly descriptionText = input<string>();

  private _bitTooltip = signal("");

  private resolvedTooltipText = computed(() => {
    return this.bitTooltip() ?? this._bitTooltip();
  });

  private isVisible = signal(false);
  private overlayRef: OverlayRef | undefined;
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
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
            content: this.resolvedTooltipText,
            isVisible: this.isVisible,
            tooltipPosition: this.tooltipPosition,
          },
        },
      ],
    }),
  );

  private destroyTooltip = () => {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.isVisible.set(false);
  };

  private showTooltip = () => {
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        ...this.defaultPopoverConfig,
        positionStrategy: this.positionStrategy,
      });

      const tooltipRef = this.overlayRef.attach(this.tooltipPortal);
      tooltipRef.changeDetectorRef.detectChanges();

      const hostEl = tooltipRef.location.nativeElement as HTMLElement;
      const tooltipId = hostEl.querySelector("[role='tooltip']")?.id;
      const currentDescribedBy = this.elementRef.nativeElement.getAttribute("aria-describedby");

      if (currentDescribedBy) {
        this.elementRef.nativeElement.setAttribute(
          "aria-describedby",
          `${currentDescribedBy} ${tooltipId}`,
        );
      } else {
        this.elementRef.nativeElement.setAttribute("aria-describedby", tooltipId);
      }
    }

    this.isVisible.set(true);
  };

  private hideTooltip = () => {
    this.destroyTooltip();
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

  setContent(text: string) {
    this._bitTooltip.set(text);
  }

  ngOnInit() {
    this.positionStrategy.withPositions(this.computePositions(this.tooltipPosition()));
  }
}
