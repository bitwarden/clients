import { ContextConsumer, ContextProvider, createContext } from "@lit/context";
import { ReactiveControllerHost } from "lit";

import type { FilterEntry } from "./filter-model";

/** An entry element registered with its nearest `bit-filter-menu` / section / option ancestor. */
export type FilterEntryElement = HTMLElement & FilterEntry;

/** What a parent offers its child entries. Replaces the `FILTER_ENTRY` content query. */
export interface FilterEntryParent {
  register(entry: FilterEntryElement): void;
  unregister(entry: FilterEntryElement): void;
  /** A descendant entry's label or properties changed; the chip needs to redraw. */
  entryChanged(): void;
}

/** @internal */
export const filterEntryParentContext = createContext<FilterEntryParent>(
  Symbol("bit-filter-entry-parent"),
);

type Host = ReactiveControllerHost & HTMLElement;

function byDocumentPosition(a: Node, b: Node): number {
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Collects the entries directly beneath `host`, wherever they sit in its subtree (wrapper elements
 * and other components' shadow roots included), in document order.
 *
 * @internal
 */
export class FilterEntryChildren implements FilterEntryParent {
  private readonly entries = new Set<FilterEntryElement>();
  private sorted?: FilterEntryElement[];

  constructor(
    host: Host,
    private readonly onChange: () => void,
  ) {
    new ContextProvider(host, filterEntryParentContext, this);
  }

  get list(): readonly FilterEntryElement[] {
    return (this.sorted ??= [...this.entries].sort(byDocumentPosition));
  }

  register(entry: FilterEntryElement) {
    this.entries.add(entry);
    this.sorted = undefined;
    this.onChange();
  }

  unregister(entry: FilterEntryElement) {
    if (this.entries.delete(entry)) {
      this.sorted = undefined;
      this.onChange();
    }
  }

  entryChanged() {
    this.onChange();
  }
}

/**
 * Registers `host` with its nearest entry parent and reports changes to it, including edits to
 * the host's own text (option labels are their text content).
 *
 * @internal
 */
export class FilterEntryRegistration {
  private parent?: FilterEntryParent;
  private readonly observer: MutationObserver;

  constructor(private readonly host: Host & FilterEntry) {
    new ContextConsumer(
      host,
      filterEntryParentContext,
      (parent) => {
        if (parent !== this.parent) {
          this.parent?.unregister(host);
          this.parent = parent;
          parent.register(host);
        }
      },
      true,
    );
    this.observer = new MutationObserver(() => this.changed());
    host.addController({
      hostConnected: () =>
        this.observer.observe(host, { childList: true, characterData: true, subtree: true }),
      hostDisconnected: () => {
        this.observer.disconnect();
        this.parent?.unregister(host);
        this.parent = undefined;
      },
      hostUpdated: () => this.changed(),
    });
  }

  changed() {
    this.parent?.entryChanged();
  }
}
