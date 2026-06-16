import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChildren,
  input,
  linkedSignal,
} from "@angular/core";

import { BerryComponent } from "../berry/berry.component";
import { IconComponent } from "../icon";

import { FilterOptionComponent } from "./filter-option.component";

/**
 * A labelled section within a `bit-filter-chip` menu, grouping related options
 * (e.g. a collection's children, or one org's collections). When `collapsible`,
 * the header toggles the section's content open/closed. It hides itself entirely
 * when the in-menu search has hidden all of its options, so no empty headers linger.
 */
@Component({
  selector: "bit-filter-section",
  templateUrl: "./filter-section.component.html",
  imports: [IconComponent, BerryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[hidden]": "empty()",
  },
})
export class FilterSectionComponent {
  /** The section header text. */
  readonly label = input.required<string>();

  /** Whether the header toggles the section open/closed. */
  readonly collapsible = input(false, { transform: booleanAttribute });

  /** Whether the section starts expanded (only meaningful when collapsible). */
  readonly expanded = input(true, { transform: booleanAttribute });

  private readonly options = contentChildren(FilterOptionComponent, { descendants: true });

  /** All projected options hidden (by the in-menu search) — the section has nothing to show. */
  protected readonly empty = computed(() => {
    const options = this.options();
    return options.length > 0 && options.every((o) => o.hidden());
  });

  /** How many of the section's options are selected — shown as a header berry. */
  protected readonly selectedCount = computed(
    () => this.options().filter((o) => o.selected()).length,
  );

  /** Open state, seeded from `expanded` and thereafter driven by the header. */
  protected readonly open = linkedSignal(() => this.expanded());

  protected toggle(): void {
    if (this.collapsible()) {
      this.open.update((o) => !o);
    }
  }
}
