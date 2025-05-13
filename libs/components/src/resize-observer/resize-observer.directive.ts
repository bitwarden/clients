import { Directive, ElementRef, EventEmitter, Output, OnDestroy } from "@angular/core";

@Directive({
  selector: "[resizeObserver]",
  standalone: true,
})
export class ResizeObserverDirective implements OnDestroy {
  private entriesMap = new WeakMap();

  private observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (this.entriesMap.has(entry.target)) {
        const comp = this.entriesMap.get(entry.target);
        comp._resizeCallback(entry);
      }
    }
  });

  @Output()
  resize = new EventEmitter();

  constructor(private el: ElementRef) {
    const target = this.el.nativeElement;
    this.entriesMap.set(target, this);
    this.observer.observe(target);
  }

  _resizeCallback(entry: ResizeObserverEntry) {
    this.resize.emit(entry);
  }

  ngOnDestroy() {
    const target = this.el.nativeElement;
    this.observer.unobserve(target);
    this.entriesMap.delete(target);
  }
}
