import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  forwardRef,
  input,
  viewChild,
} from "@angular/core";

import { FILTER_ENTRY, FilterEntry } from "./filter-tokens";

/**
 * A selectable option inside a `bit-filter-menu`. It's **declarative**: it holds the
 * `value`, optional `count`, and `disabled` state, and captures its projected label
 * text — it renders no visible UI of its own. The chip draws the actual row (indicator,
 * label, count) and handles selection, so the same options render independently in the
 * popover and the responsive filter dialog without sharing one set of projected nodes.
 */
@Component({
  selector: "bit-filter-option",
  template: `<span #label><ng-content></ng-content></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Never shown directly; the chip renders the visible row from this declaration.
  host: { class: "tw-hidden" },
  providers: [{ provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterOptionComponent) }],
})
export class FilterOptionComponent<T = unknown> implements FilterEntry {
  readonly kind = "option" as const;

  /** The value contributed to the chip's selection when chosen. */
  readonly value = input.required<T>();

  /**
   * Optional trailing count. Overrides the host's automatic faceted count (how many
   * rows match this option given the other active filters) — set it for server-side
   * filtering, where the host can't compute the count itself.
   */
  readonly count = input<number>();

  /** Whether the option is selectable. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly labelEl = viewChild<ElementRef<HTMLElement>>("label");

  /** The projected label text — the chip renders it, and reads it for search and the summary. */
  label(): string {
    return this.labelEl()?.nativeElement.textContent?.trim() ?? "";
  }
}
