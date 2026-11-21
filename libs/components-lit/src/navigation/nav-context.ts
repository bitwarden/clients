import { Context, ContextConsumer, createContext } from "@lit/context";
import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

/** What a `bit-nav-group` offers its nested nav components. Replaces `NavGroupAbstraction`. */
export interface NavGroupParent {
  readonly depth: number;
  setOpen(open: boolean): void;
}

export const navGroupContext = createContext<NavGroupParent>(Symbol("bit-nav-group"));

/**
 * Provided by each nav group and nav section. Nested groups that render a leading collapse toggle
 * register here, so leaf siblings can reserve the toggle's width and keep their content aligned.
 */
export class NavToggleScope {
  private toggleCount = 0;
  private readonly listeners = new Set<() => void>();

  get hasStartToggle() {
    return this.toggleCount > 0;
  }

  /** Returns the callback that unregisters the toggle. */
  register(): () => void {
    this.change(1);
    let registered = true;
    return () => {
      if (registered) {
        registered = false;
        this.change(-1);
      }
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private change(delta: number) {
    const before = this.hasStartToggle;
    this.toggleCount += delta;
    if (before !== this.hasStartToggle) {
      this.listeners.forEach((listener) => listener());
    }
  }
}

export const navToggleScopeContext = createContext<NavToggleScope>(Symbol("bit-nav-toggle-scope"));

/**
 * Assigns children to named slots by `slot` attribute first, then by tag name (like Angular's
 * `<ng-content select="tag">`); everything else goes to the unnamed slot. The host must use
 * `slotAssignment: "manual"`.
 *
 * @internal
 */
export class SlotAssignController implements ReactiveController {
  private readonly observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) => record.target === this.host || record.target.parentNode === this.host,
      )
    ) {
      this.assign();
    }
  });

  constructor(
    private readonly host: LitElement,
    private readonly tags: Record<string, string>,
    private readonly onAssign?: () => void,
  ) {
    host.addController(this);
  }

  hostConnected() {
    this.observer.observe(this.host, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ["slot"],
    });
  }

  hostDisconnected() {
    this.observer.disconnect();
  }

  hostUpdated() {
    this.assign();
  }

  /** Children currently headed for slot `name`, whether or not that slot is rendered. */
  nodesFor(name: string): Node[] {
    return Array.from(this.host.childNodes).filter(
      (node) =>
        (node instanceof Element || (node instanceof Text && !!node.textContent?.trim())) &&
        this.slotNameFor(node) === name,
    );
  }

  private slotNameFor(node: Node): string {
    if (!(node instanceof Element)) {
      return "";
    }
    const attr = node.getAttribute("slot");
    if (attr) {
      return attr;
    }
    return Object.entries(this.tags).find(([, tag]) => tag === node.localName)?.[0] ?? "";
  }

  private assign() {
    const root = this.host.shadowRoot;
    if (!root) {
      return;
    }
    const buckets = new Map<string, Node[]>();
    for (const node of Array.from(this.host.childNodes)) {
      if (!(node instanceof Element || node instanceof Text)) {
        continue;
      }
      const name = this.slotNameFor(node);
      buckets.set(name, [...(buckets.get(name) ?? []), node]);
    }
    root.querySelectorAll("slot").forEach((slot) => {
      slot.assign(...((buckets.get(slot.name) ?? []) as (Element | Text)[]));
    });
    this.onAssign?.();
  }
}

type Subscribable = { subscribe(listener: () => void): () => void };

/**
 * A context consumer that also re-renders the host whenever the (subscribable) value changes.
 *
 * @internal
 */
export class SubscribedContextConsumer<T extends Subscribable> implements ReactiveController {
  private readonly consumer: ContextConsumer<
    Context<unknown, T>,
    ReactiveControllerHost & HTMLElement
  >;
  private unsubscribe?: () => void;

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    context: Context<unknown, T>,
    private readonly onChange?: (value: T) => void,
  ) {
    host.addController(this);
    this.consumer = new ContextConsumer(
      host,
      context,
      (value) => {
        this.unsubscribe?.();
        this.unsubscribe = value.subscribe(() => host.requestUpdate());
        this.onChange?.(value);
      },
      true,
    );
  }

  get value(): T | undefined {
    return this.consumer.value;
  }

  hostDisconnected() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
