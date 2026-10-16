/**
 * `bit-table-toolbar` collapses by its own width, and jsdom measures nothing, so an unmeasured
 * toolbar stays wide. Stands in for `ResizeObserver`, reporting `width` for the toolbar and 0 for
 * every other element, so the chip row's overflow list stays unmeasured and shows every chip.
 */
export function stubToolbarWidth(initialWidth: number): {
  setWidth(width: number): void;
  restore(): void;
} {
  const original = globalThis.ResizeObserver;
  const observers = new Set<ResizeObserverStub>();
  let width = initialWidth;

  class ResizeObserverStub {
    private readonly targets: Element[] = [];

    constructor(private readonly callback: ResizeObserverCallback) {
      observers.add(this);
    }

    observe(target: Element) {
      this.targets.push(target);
      this.report(target);
    }

    unobserve() {}

    disconnect() {
      observers.delete(this);
    }

    reportAll() {
      this.targets.forEach((target) => this.report(target));
    }

    private report(target: Element) {
      const reported = target.localName === "bit-table-toolbar" ? width : 0;
      const entry = { target, contentRect: { width: reported } } as unknown as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }
  }

  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  return {
    setWidth(next: number) {
      width = next;
      observers.forEach((observer) => observer.reportAll());
    },
    restore() {
      globalThis.ResizeObserver = original;
    },
  };
}
