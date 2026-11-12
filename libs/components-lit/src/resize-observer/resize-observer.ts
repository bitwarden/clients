import { ElementPart, nothing } from "lit";
import { AsyncDirective, directive, PartInfo, PartType } from "lit/async-directive.js";

export type ResizeCallback = (entry: ResizeObserverEntry) => void;

export type ResizeObserverHandle = { destroy(): void };

/**
 * Calls `callback` whenever `el` resizes and dispatches a non-bubbling `resize` `CustomEvent` on
 * it with the `ResizeObserverEntry` as `detail`, matching the Angular `(resize)` output.
 */
export function attachResizeObserver(el: Element, callback?: ResizeCallback): ResizeObserverHandle {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === el) {
        callback?.(entry);
        el.dispatchEvent(new CustomEvent<ResizeObserverEntry>("resize", { detail: entry }));
      }
    }
  });
  observer.observe(el);
  return { destroy: () => observer.disconnect() };
}

class ResizeObserverDirective extends AsyncDirective {
  private handle?: ResizeObserverHandle;
  private element?: Element;
  private callback?: ResizeCallback;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("onResize() must be used in an element position");
    }
  }

  render(_callback: ResizeCallback) {
    return nothing;
  }

  update(part: ElementPart, [callback]: Parameters<this["render"]>) {
    this.callback = callback;
    if (!this.handle) {
      this.element = part.element;
      this.handle = attachResizeObserver(this.element, (entry) => this.callback?.(entry));
    }
    return nothing;
  }

  protected disconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected reconnected() {
    if (this.element) {
      this.handle = attachResizeObserver(this.element, (entry) => this.callback?.(entry));
    }
  }
}

/**
 * Calls `callback` with the `ResizeObserverEntry` whenever the element resizes.
 *
 * ```ts
 * html`<div ${onResize((entry) => (this.width = entry.contentRect.width))}></div>`
 * ```
 */
export const onResize = directive(ResizeObserverDirective);
