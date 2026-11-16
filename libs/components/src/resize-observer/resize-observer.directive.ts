import { Directive, ElementRef, inject, OnDestroy, output } from "@angular/core";

@Directive({
  selector: "[resizeObserver]",
})
export class ResizeObserverDirective implements OnDestroy {
  private readonly el = inject(ElementRef);

  private readonly observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === this.el.nativeElement) {
        this._resizeCallback(entry);
      }
    }
  });

  readonly resize = output<ResizeObserverEntry>();

  constructor() {
    this.observer.observe(this.el.nativeElement);
  }

  _resizeCallback(entry: ResizeObserverEntry) {
    this.resize.emit(entry);
  }

  ngOnDestroy() {
    this.observer.unobserve(this.el.nativeElement);
  }
}
