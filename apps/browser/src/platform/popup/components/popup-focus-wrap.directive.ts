import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2 } from "@angular/core";

/**
 * Directive that wraps Tab focus within the host element.
 *
 * Firefox does not cycle focus within extension popups — after the last focusable
 * element, focus moves to the document body and gets stuck instead of wrapping
 * back to the first element.
 *
 * This directive adds invisible sentinel elements at the start and end of the host.
 * When a sentinel receives focus (via Tab / Shift+Tab), focus is redirected to the
 * opposite end of the focusable elements within the host.
 */
@Directive({
  selector: "[appPopupFocusWrap]",
  standalone: true,
})
export class PopupFocusWrapDirective implements AfterViewInit, OnDestroy {
  private sentinels: { start: HTMLElement; end: HTMLElement } | undefined;
  private cleanupFns: (() => void)[] = [];

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  ngAfterViewInit() {
    const start = this.createSentinel();
    const end = this.createSentinel();
    this.sentinels = { start, end };

    const host = this.el.nativeElement;
    this.renderer.insertBefore(host, start, host.firstChild);
    this.renderer.appendChild(host, end);

    this.cleanupFns.push(
      this.renderer.listen(start, "focus", () => {
        this.focusLast();
      }),
    );

    this.cleanupFns.push(
      this.renderer.listen(end, "focus", () => {
        this.focusFirst();
      }),
    );
  }

  ngOnDestroy() {
    for (const fn of this.cleanupFns) {
      fn();
    }
  }

  private createSentinel(): HTMLElement {
    const sentinel = this.renderer.createElement("div");
    this.renderer.setAttribute(sentinel, "tabindex", "0");
    this.renderer.setAttribute(sentinel, "aria-hidden", "true");
    this.renderer.setStyle(sentinel, "position", "fixed");
    this.renderer.setStyle(sentinel, "width", "0");
    this.renderer.setStyle(sentinel, "height", "0");
    this.renderer.setStyle(sentinel, "overflow", "hidden");
    return sentinel;
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'a[href]:not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(selector)).filter(
      (el) =>
        el !== this.sentinels?.start && el !== this.sentinels?.end && el.offsetParent !== null,
    );
  }

  private focusFirst() {
    const elements = this.getFocusableElements();
    elements[0]?.focus();
  }

  private focusLast() {
    const elements = this.getFocusableElements();
    elements[elements.length - 1]?.focus();
  }
}
