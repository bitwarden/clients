import { LitElement, ReactiveController } from "lit";

/**
 * Assigns children to named slots by tag name, like Angular's `<ng-content select="tag">`, so
 * consumers don't need `slot` attributes. The host must use `slotAssignment: "manual"`; children
 * matching no tag go to the unnamed slot.
 *
 * @internal
 */
export class SlotByTagController implements ReactiveController {
  private readonly observer = new MutationObserver(() => this.assign());

  constructor(
    private readonly host: LitElement,
    private readonly tags: Record<string, string>,
  ) {
    host.addController(this);
  }

  hostConnected() {
    this.observer.observe(this.host, { childList: true });
  }

  hostDisconnected() {
    this.observer.disconnect();
  }

  hostUpdated() {
    this.assign();
  }

  private assign() {
    const root = this.host.shadowRoot;
    if (!root) {
      return;
    }
    const buckets = new Map<string, (Element | Text)[]>();
    for (const node of Array.from(this.host.childNodes)) {
      if (!(node instanceof Element || node instanceof Text)) {
        continue;
      }
      const tag = node instanceof Element ? node.localName : "";
      const name = Object.entries(this.tags).find(([, t]) => t === tag)?.[0] ?? "";
      buckets.set(name, [...(buckets.get(name) ?? []), node]);
    }
    root.querySelectorAll("slot").forEach((slot) => {
      slot.assign(...(buckets.get(slot.name) ?? []));
    });
  }
}
