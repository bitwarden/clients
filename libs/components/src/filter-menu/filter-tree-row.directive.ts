import { TreeKeyManagerItem } from "@angular/cdk/a11y";
import {
  Directive,
  ElementRef,
  computed,
  contentChild,
  inject,
  input,
  signal,
} from "@angular/core";

import { TooltipDirective } from "../tooltip";

import { FILTER_TREE_HOST, FilterTreeHost, FilterTreeNode } from "./filter-tokens";

/** One row of a multi-select filter menu's tree, adapting it to CDK's {@link TreeKeyManagerItem}. */
@Directive({
  selector: "[bitFilterTreeRow]",
  exportAs: "bitFilterTreeRow",
  host: {
    "[tabindex]": "tabbable() ? 0 : -1",
    "(focus)": "onFocus()",
    "(blur)": "labelTooltip()?.hideTooltip()",
  },
})
export class FilterTreeRowDirective implements TreeKeyManagerItem {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly host = inject<FilterTreeHost>(FILTER_TREE_HOST);

  readonly node = input.required<FilterTreeNode>({ alias: "bitFilterTreeRow" });

  /** Whether this row currently holds the tree's single tab stop. */
  readonly tabbable = signal(false);

  readonly isDisabled = computed(() => this.node().row.disabled());

  /** `focusin` only bubbles up, so the row opens its label's tooltip itself. */
  protected readonly labelTooltip = contentChild(TooltipDirective);

  /** Opens on keyboard focus only, as the tooltip does for its own host. */
  protected onFocus(): void {
    if (this.el.nativeElement.matches(":focus-visible")) {
      this.labelTooltip()?.showTooltip();
    }
  }

  /** @see TreeKeyManagerItem.getLabel — the manager's typeahead matches on this. */
  getLabel(): string {
    return this.node().row.label();
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

  isExpanded = (): boolean => this.node().expanded;

  expand(): void {
    if (!this.isExpanded()) {
      this.node().row.toggleExpanded();
    }
  }

  collapse(): void {
    if (this.isExpanded()) {
      this.node().row.toggleExpanded();
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
