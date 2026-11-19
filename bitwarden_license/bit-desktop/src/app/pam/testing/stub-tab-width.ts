/**
 * The PAM tabs drop table columns by their own width, and jsdom measures nothing. Stands in for
 * `ResizeObserver`, reporting `width` for the tab host and 0 for anything inside or part of a
 * design-system (`bit-*`) component, so the table and its toolbar stay unmeasured and show every
 * control. The host is told apart that way because `TestBed` renders a root component into a
 * plain element rather than one named by its selector.
 */
export function stubTabWidth(initialWidth: number): {
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
      const reported = withinDesignSystem(target) ? 0 : width;
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

function withinDesignSystem(element: Element): boolean {
  for (let node: Element | null = element; node != null; node = node.parentElement) {
    if (node.localName.startsWith("bit-")) {
      return true;
    }
  }
  return false;
}
