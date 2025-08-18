import { Directive, ElementRef, EventEmitter, Output, OnDestroy } from "@angular/core";

@Directive({
  selector: "[resizeObserver]",
  standalone: true,
})
export class ResizeObserverDirective implements OnDestroy {
  private observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === this.el.nativeElement) {
        this._resizeCallback(entry);
      }
    }
  });

  @Output()
  resize = new EventEmitter();

  constructor(private el: ElementRef) {
    this.observer.observe(this.el.nativeElement);
  }

  _resizeCallback(entry: ResizeObserverEntry) {
    this.resize.emit(entry);
  }

  ngOnDestroy() {
    this.observer.unobserve(this.el.nativeElement);
  }
}
