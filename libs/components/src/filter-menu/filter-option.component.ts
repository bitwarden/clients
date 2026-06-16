import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  viewChild,
} from "@angular/core";

import { IconComponent } from "../icon";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-item.component";

import { FILTER_GROUP } from "./filter-tokens";

/**
 * A selectable option inside a `bit-filter-chip`. Renders as a menu row — styled
 * like `bitMenuItem` — with a radio or checkbox indicator (per the chip's
 * `multiple`), the projected label, and an optional trailing count. Clicking
 * selects/toggles it through the chip; the chip reads its label for the summary.
 */
@Component({
  selector: "bit-filter-option",
  templateUrl: "./filter-option.component.html",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterOptionComponent<T = unknown> {
  /** The value contributed to the chip's selection when chosen. */
  readonly value = input.required<T>();

  /** Optional trailing count (e.g. how many rows match this option). */
  readonly count = input<number>();

  /** Whether the option is selectable. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly group = inject(FILTER_GROUP);

  /** The projected label text, used by the chip for its summary (excludes the count). */
  private readonly labelEl = viewChild<ElementRef<HTMLElement>>("label");

  /** The same appearance as `bitMenuItem`, plus the flex layout for the indicator/label/count. */
  protected readonly buttonClasses = [
    "tw-flex",
    "tw-items-center",
    "tw-gap-2",
    ...menuItemBaseStyles,
    ...menuItemPrimaryStyles,
  ];

  /** Checkbox indicator for a multi-select chip, radio indicator otherwise. */
  protected readonly multiple = this.group.multiple;

  /** Whether this option is currently selected (reacts to the chip's selection). */
  readonly selected = computed(() => this.group.isSelected(this.value()));

  /** Hidden when the menu's search term doesn't match this option's label. */
  readonly hidden = computed(() => {
    const term = this.group.searchTerm().trim().toLowerCase();
    if (term === "") {
      return false;
    }
    return !this.label().toLowerCase().includes(term);
  });

  /** The rendered label text, excluding the count. Read by the chip for its summary. */
  label(): string {
    return this.labelEl()?.nativeElement.textContent?.trim() ?? "";
  }

  protected toggle(): void {
    if (!this.disabled()) {
      this.group.toggle(this.value());
    }
  }
}
