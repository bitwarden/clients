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
  model,
  computed,
  OnDestroy,
} from "@angular/core";

import { TooltipPositionIdentifier, tooltipPositions } from "./tooltip-positions";
import { TooltipComponent, TOOLTIP_DATA } from "./tooltip.component";

export const TOOLTIP_DELAY_MS = 800;

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
    "[attr.aria-describedby]": "resolvedDescribedByIds()",
  },
})
export class TooltipDirective implements OnInit, OnDestroy {
  private static nextId = 0;
  /**
   * The value of this input is forwarded to the tooltip.component to render
   */
  readonly tooltipContent = model("", { alias: "bitTooltip" });
  /**
   * The value of this input is forwarded to the tooltip.component to set its position explicitly.
   * @default "above-center"
   */
  readonly tooltipPosition = input<TooltipPositionIdentifier>("above-center");

  /**
   * Input so the consumer can choose to add the tooltip id to the aria-describedby attribute of the host element.
   */
  readonly addTooltipToDescribedby = input<boolean>(false);

  private readonly isVisible = signal(false);
  private overlayRef: OverlayRef | undefined;
  private showTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo(this.elementRef)
    .withFlexibleDimensions(false)
    .withPush(true);
  private tooltipId = `bit-tooltip-${TooltipDirective.nextId++}`;
  private currentDescribedByIds =
    this.elementRef.nativeElement.getAttribute("aria-describedby") || null;

  private tooltipPortal = new ComponentPortal(
    TooltipComponent,
    this.viewContainerRef,
    Injector.create({
      providers: [
        {
          provide: TOOLTIP_DATA,
          useValue: {
            content: this.tooltipContent,
            isVisible: this.isVisible,
            tooltipPosition: this.tooltipPosition,
            id: signal(this.tooltipId),
          },
        },
      ],
    }),
  );

  /**
   * Clear any pending show timeout
   *
   * Use cases: prevent tooltip from appearing after hide; clear existing timeout before showing a
   * new tooltip
   */
  private clearTimeout() {
    if (this.showTimeoutId !== undefined) {
      clearTimeout(this.showTimeoutId);
      this.showTimeoutId = undefined;
    }
  }

  private destroyTooltip = () => {
    this.clearTimeout();
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.isVisible.set(false);
  };

  protected showTooltip = () => {
    this.clearTimeout();

    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        ...this.defaultPopoverConfig,
        positionStrategy: this.positionStrategy,
      });

      this.overlayRef.attach(this.tooltipPortal);
    }

    this.showTimeoutId = setTimeout(() => {
      this.isVisible.set(true);
      this.showTimeoutId = undefined;
    }, TOOLTIP_DELAY_MS);
  };

  protected hideTooltip = () => {
    this.destroyTooltip();
  };

  protected readonly resolvedDescribedByIds = computed(() => {
    if (this.addTooltipToDescribedby()) {
      if (this.currentDescribedByIds) {
        return `${this.currentDescribedByIds || ""} ${this.tooltipId}`;
      } else {
        return this.tooltipId;
      }
    } else {
      return this.currentDescribedByIds;
    }
  });

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
  }

  ngOnDestroy(): void {
    this.destroyTooltip();
  }
}
