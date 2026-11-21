/**
 * Assigns `host`'s children to named slots in its shadow root (which must use
 * `slotAssignment: "manual"`) by matching selectors, so consumers can project well-known elements
 * (`bit-table-toolbar`, `bit-search`, ...) without a `slot` attribute, like Angular's
 * `<ng-content select>`. Children that match no rule go to the default (unnamed) slot.
 */
export class SlotAssigner {
  private readonly observer = new MutationObserver(() => {
    this.assign();
    this.onAssign?.();
  });

  constructor(
    private readonly host: HTMLElement,
    private readonly rules: readonly [selector: string, slot: string][],
    /** Called when children change (not on every {@link assign}). */
    private readonly onAssign?: () => void,
  ) {}

  connect() {
    this.observer.observe(this.host, {
      childList: true,
      attributes: true,
      attributeFilter: ["slot"],
    });
    this.assign();
    this.onAssign?.();
  }

  disconnect() {
    this.observer.disconnect();
  }

  assign() {
    const root = this.host.shadowRoot;
    if (!root) {
      return;
    }
    const buckets = new Map<string, (Element | Text)[]>();
    for (const node of Array.from(this.host.childNodes)) {
      let name = "";
      if (node instanceof Element) {
        name = this.rules.find(([selector]) => node.matches(selector))?.[1] ?? "";
      } else if (!(node instanceof Text) || !node.data.trim()) {
        continue;
      }
      // Narrowed above; TS can't follow the `continue`.
      const assignable = node as Element | Text;
      buckets.set(name, [...(buckets.get(name) ?? []), assignable]);
    }
    for (const slot of Array.from(root.querySelectorAll("slot"))) {
      const nodes = buckets.get(slot.name) ?? [];
      const current = slot.assignedNodes();
      if (current.length !== nodes.length || current.some((n, i) => n !== nodes[i])) {
        slot.assign(...nodes);
      }
    }
  }
}
