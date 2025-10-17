import { AfterViewInit, Directive, ElementRef, NgZone } from "@angular/core";

@Directive({
  selector: "[appPageFocus]",
  standalone: true,
})
export class AppPageFocusDirective implements AfterViewInit {
  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    const el = this.el.nativeElement;

    const naturallyFocusable =
      el instanceof HTMLButtonElement ||
      el instanceof HTMLAnchorElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      el.hasAttribute("tabindex");

    if (!naturallyFocusable) {
      el.setAttribute("tabindex", "-1");
    }

    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => el.focus({ preventScroll: false }));
    });
  }
}
