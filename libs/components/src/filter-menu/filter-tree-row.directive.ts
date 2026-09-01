import { TreeKeyManagerItem } from "@angular/cdk/a11y";
import { Directive, ElementRef, computed, inject, input, signal } from "@angular/core";

import { FILTER_TREE_HOST, FilterTreeHost, FilterTreeNode } from "./filter-tokens";

/**
 * One row of a multi-select filter menu's tree, adapting it to CDK's
 * {@link TreeKeyManagerItem}. The row is the item rather than the `bit-filter-option`
 * behind it: an option is declared once but rendered per surface, so only the row maps
 * one-to-one onto something focusable.
 */
@Directive({
  selector: "[bitFilterTreeRow]",
  exportAs: "bitFilterTreeRow",
  host: {
    "[tabindex]": "tabbable() ? 0 : -1",
  },
})
export class FilterTreeRowDirective implements TreeKeyManagerItem {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly host = inject<FilterTreeHost>(FILTER_TREE_HOST);

  readonly node = input.required<FilterTreeNode>({ alias: "bitFilterTreeRow" });

  /** Whether this row currently holds the tree's single tab stop. */
  readonly tabbable = signal(false);

  readonly isDisabled = computed(() => this.host.nodeDisabled(this.node()));

  /** @see TreeKeyManagerItem.getLabel — the manager's typeahead matches on this. */
  getLabel(): string {
    return this.host.nodeLabel(this.node());
  }

  activate(): void {
    if (!this.isDisabled()) {
      this.host.activateNode(this.node());
    }
  }

  getParent(): FilterTreeRowDirective | null {
    return this.host.parentRow(this);
  }

  getChildren(): FilterTreeRowDirective[] {
    return this.host.childRows(this);
  }

  isExpanded = (): boolean => this.host.nodeExpanded(this.node());

  expand(): void {
    if (!this.isExpanded()) {
      this.host.toggleNodeExpanded(this.node());
    }
  }

  collapse(): void {
    if (this.isExpanded()) {
      this.host.toggleNodeExpanded(this.node());
    }
  }

  focus(): void {
    this.tabbable.set(true);
    this.el.nativeElement.focus();
  }

  unfocus(): void {
    this.tabbable.set(false);
  }

  /** Becomes the tab stop without stealing focus — how the manager seeds the tree. */
  makeFocusable(): void {
    this.tabbable.set(true);
  }
}
