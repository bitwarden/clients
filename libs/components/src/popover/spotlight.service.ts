import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { DomPortal } from "@angular/cdk/portal";
import { ElementRef, Injectable, inject } from "@angular/core";

import type { PopoverAnchorForDirective } from "./popover-anchor-for.directive";

/**
 * Service that coordinates spotlight effects across multiple popover instances.
 * Manages smooth transitions between spotlight targets to prevent flickering.
 * Only one spotlight can be active at a time.
 */
@Injectable({ providedIn: "root" })
export class SpotlightService {
  private readonly overlay = inject(Overlay);
  private readonly backdropElement: HTMLElement;
  private readonly borderElement: HTMLElement;
  private currentTarget: HTMLElement | null = null;
  private currentPadding = 0;
  private borderOverlayRef: OverlayRef | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hideTimeout: number | null = null;
  private activePopover: PopoverAnchorForDirective | null = null;

  constructor() {
    // Create backdrop element (initially hidden)
    this.backdropElement = document.createElement("div");
    this.backdropElement.style.cssText = `
      position: fixed;
      inset: 0;
      background: transparent;
      z-index: 999;
      pointer-events: auto;
      display: none;
    `;
    this.backdropElement.setAttribute("data-spotlight-backdrop", "true");
    document.body.appendChild(this.backdropElement);

    // Create border element — attached to a CDK overlay pane when spotlight is active.
    // Must be appended to the DOM so DomPortal has a parent node to detach it from.
    this.borderElement = document.createElement("div");
    this.borderElement.style.cssText = `
      box-shadow: 0 0 0 9999px var(--color-bg-overlay);
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: none;
    `;
    this.borderElement.setAttribute("data-spotlight-border", "true");
    document.body.appendChild(this.borderElement);
  }

  /**
   * Shows spotlight on the target element.
   * If a spotlight is already active, smoothly transitions to the new target.
   * @param target - The element to highlight
   * @param padding - Padding around the element in pixels
   */
  showSpotlight(target: HTMLElement, padding: number): void {
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentTarget === target && this.currentPadding === padding) {
      return;
    }

    const isNewTarget = this.currentTarget !== target;
    this.currentTarget = target;
    this.currentPadding = padding;

    // Scroll the new target into view
    if (isNewTarget && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }

    this.backdropElement.style.display = "block";

    // Recreate the CDK border overlay for the new target/padding
    this.disposeBorderOverlay();
    this.createBorderOverlay(target, padding);
  }

  /**
   * The CDK overlay pane element for the active spotlight border.
   * Used by PopoverAnchorForDirective as the popover origin when spotlight is enabled,
   * so the popover naturally attaches to the outer edge of the highlighted area.
   */
  get overlayElement(): HTMLElement | null {
    return this.borderOverlayRef?.overlayElement ?? null;
  }

  /**
   * Registers a popover as the active spotlight popover.
   * Closes any other active spotlight popover.
   */
  register(directive: PopoverAnchorForDirective): void {
    if (this.activePopover && this.activePopover !== directive) {
      this.activePopover.closePopover();
    }
    this.activePopover = directive;
  }

  /**
   * Unregisters a popover when it closes.
   */
  unregister(directive: PopoverAnchorForDirective): void {
    if (this.activePopover === directive) {
      this.activePopover = null;
    }
  }

  /**
   * Hides the spotlight and cleans up.
   * Hiding is delayed to allow smooth transitions between spotlight targets.
   */
  hideSpotlight(): void {
    this.hideTimeout = window.setTimeout(() => {
      this.backdropElement.style.display = "none";
      this.disposeBorderOverlay();
      this.currentTarget = null;
      this.currentPadding = 0;
      this.hideTimeout = null;
    }, 100);
  }

  /**
   * Creates a CDK overlay for the border/cutout element, connected to the target.
   * Uses the reposition scroll strategy so CDK repositions the pane on every animation
   * frame during scroll — including smooth-scroll animations triggered by scrollIntoView.
   */
  private createBorderOverlay(target: HTMLElement, padding: number): void {
    const computedStyle = window.getComputedStyle(target);
    this.borderElement.style.borderRadius = computedStyle.borderRadius;

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(new ElementRef(target))
      .withPositions([
        {
          originX: "start",
          originY: "top",
          overlayX: "start",
          overlayY: "top",
          offsetX: -padding,
          offsetY: -padding,
        },
      ])
      .withLockedPosition(false)
      .withFlexibleDimensions(false)
      .withPush(false);

    this.borderOverlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: target.offsetWidth + padding * 2,
      height: target.offsetHeight + padding * 2,
    });

    this.borderElement.style.display = "block";
    this.borderOverlayRef.attach(new DomPortal(this.borderElement));

    // Resize observer keeps the overlay size in sync if the target element resizes
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.currentTarget || !this.borderOverlayRef) {
        return;
      }
      this.borderOverlayRef.updateSize({
        width: this.currentTarget.offsetWidth + padding * 2,
        height: this.currentTarget.offsetHeight + padding * 2,
      });
      this.borderOverlayRef.updatePosition();
    });
    this.resizeObserver.observe(target);
  }

  private disposeBorderOverlay(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.borderOverlayRef?.dispose(); // CDK moves borderElement back to document.body
    this.borderOverlayRef = null;
    this.borderElement.style.display = "none";
  }
}
