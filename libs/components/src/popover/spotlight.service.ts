import { Injectable } from "@angular/core";

import type { PopoverAnchorDirective } from "./popover-anchor.directive";

/**
 * Service that coordinates spotlight effects across multiple popover instances.
 * Manages smooth transitions between spotlight targets to prevent flickering.
 * Only one spotlight can be active at a time.
 */
@Injectable({ providedIn: "root" })
export class SpotlightService {
  private readonly backdropElement: HTMLElement;
  private readonly borderElement: HTMLElement;
  private currentTarget: HTMLElement | null = null;
  private currentPadding = 0;
  private resizeObserver: ResizeObserver | null = null;
  private scrollListener: (() => void) | null = null;
  private hideTimeout: number | null = null;
  private activePopover: PopoverAnchorDirective | null = null;

  constructor() {
    // Create backdrop element (initially hidden)
    this.backdropElement = document.createElement("div");
    this.backdropElement.style.cssText = `
      position: fixed;
      inset: 0;
      background: transparent;
      z-index: 1000;
      pointer-events: auto;
      display: none;
    `;
    this.backdropElement.setAttribute("data-spotlight-backdrop", "true");
    document.body.appendChild(this.backdropElement);

    // Create border element (initially hidden)
    this.borderElement = document.createElement("div");
    this.borderElement.style.cssText = `
      position: fixed;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.2);
      z-index: 1001;
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
    // Cancel any pending hide - we're showing instead
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // If targeting the same element, just update padding if needed
    if (this.currentTarget === target) {
      if (this.currentPadding !== padding) {
        this.currentPadding = padding;
        this.updateBorderPosition();
      }
      return;
    }

    // Scroll the target element into view with smooth scrolling if the method exists
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // Unobserve old target if exists
    if (this.currentTarget && this.resizeObserver) {
      this.resizeObserver.unobserve(this.currentTarget);
    }

    // Set up listeners if not already set up
    if (!this.resizeObserver) {
      this.setupListeners();
    }

    // Update target and padding
    this.currentTarget = target;
    this.currentPadding = padding;

    // Show elements
    this.backdropElement.style.display = "block";
    this.borderElement.style.display = "block";

    // Update position
    this.updateBorderPosition();

    // Observe new target
    if (this.resizeObserver) {
      this.resizeObserver.observe(target);
    }
  }

  /**
   * Registers a popover as the active spotlight popover.
   * Closes any other active spotlight popover.
   */
  register(directive: PopoverAnchorDirective): void {
    if (this.activePopover && this.activePopover !== directive) {
      this.activePopover.closePopover();
    }
    this.activePopover = directive;
  }

  /**
   * Unregisters a popover when it closes.
   */
  unregister(directive: PopoverAnchorDirective): void {
    if (this.activePopover === directive) {
      this.activePopover = null;
    }
  }

  /**
   * Hides the spotlight and cleans up listeners.
   * Hiding is delayed to allow smooth transitions between spotlight targets.
   */
  hideSpotlight(): void {
    // Delay hiding to allow for smooth transitions between popover steps
    // If showSpotlight is called before timeout, hiding is cancelled
    this.hideTimeout = window.setTimeout(() => {
      this.backdropElement.style.display = "none";
      this.borderElement.style.display = "none";

      // Reset position
      this.borderElement.style.left = "0px";
      this.borderElement.style.top = "0px";
      this.borderElement.style.width = "0px";
      this.borderElement.style.height = "0px";

      this.resizeObserver?.disconnect();
      this.resizeObserver = null;

      if (this.scrollListener) {
        window.removeEventListener("scroll", this.scrollListener, true);
        this.scrollListener = null;
      }

      this.currentTarget = null;
      this.currentPadding = 0;
      this.hideTimeout = null;
    }, 100);
  }

  /**
   * Updates the border element position based on the current target.
   */
  private updateBorderPosition(): void {
    if (!this.currentTarget) {
      return;
    }

    const rect = this.currentTarget.getBoundingClientRect();
    const padding = this.currentPadding;
    const computedStyle = window.getComputedStyle(this.currentTarget);

    this.borderElement.style.left = `${rect.left - padding}px`;
    this.borderElement.style.top = `${rect.top - padding}px`;
    this.borderElement.style.width = `${rect.width + padding * 2}px`;
    this.borderElement.style.height = `${rect.height + padding * 2}px`;
    this.borderElement.style.borderRadius = computedStyle.borderRadius;
  }

  /**
   * Sets up resize and scroll listeners.
   */
  private setupListeners(): void {
    if (!this.currentTarget) {
      return;
    }

    // Set up resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updateBorderPosition();
    });
    this.resizeObserver.observe(this.currentTarget);

    // Set up scroll listener for nested scrollable containers
    this.scrollListener = () => {
      this.updateBorderPosition();
    };
    window.addEventListener("scroll", this.scrollListener, true);
  }
}
