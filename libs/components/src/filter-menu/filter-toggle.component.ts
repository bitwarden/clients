import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { BaseChipDirective } from "../chips/shared/base-chip.directive";
import { ChipContentComponent } from "../chips/shared/chip-content.component";
import { BitwardenIcon } from "../shared/icon";

import { FILTER_CONTROL, FilterControl } from "./filter-tokens";

/**
 * A single on/off filter chip — no menu. Use it when a filter is one element
 * rather than a category (e.g. "Favorites"). Clicking toggles it; its icon fills
 * while active. Its value is a boolean, surfaced under its `key` in the host's
 * `filterValues` via {@link FILTER_CONTROL}.
 *
 * @example
 * ```html
 * <bit-filter-toggle key="favorites" label="Favorites" icon="bwi-star"
 *   bitTableFilter></bit-filter-toggle>
 * ```
 */
@Component({
  selector: "bit-filter-toggle",
  templateUrl: "./filter-toggle.component.html",
  imports: [ChipContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FILTER_CONTROL, useExisting: forwardRef(() => FilterToggleComponent) }],
  hostDirectives: [{ directive: BaseChipDirective, inputs: ["disabled", "size", "fullWidth"] }],
})
export class FilterToggleComponent implements FilterControl {
  /** The chip's key — the property its boolean value occupies in the host's `filterValues`. */
  readonly key = input.required<string>();

  /** The chip's label. */
  readonly label = input.required<string>();

  /** Leading icon; shown filled (`-f` variant) while active when available. */
  readonly icon = input<BitwardenIcon>();

  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  private readonly _value = signal(false);

  /** The toggle's boolean value. */
  readonly value = computed<unknown>(() => this._value());

  /** Whether the toggle is on. */
  readonly active = computed(() => this._value());

  /** The displayed icon — the filled variant while active, when one is conventionally available. */
  protected readonly displayIcon = computed<BitwardenIcon | undefined>(() => {
    const icon = this.icon();
    if (!icon) {
      return undefined;
    }
    return this._value() ? ((icon + "-f") as BitwardenIcon) : icon;
  });

  protected readonly disabled = computed(() => this.baseChip.disabled());

  constructor() {
    effect(() => this.baseChip.selectedState.set(this._value()));
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    this._value.update((v) => !v);
  }

  setValue(value: unknown): void {
    this._value.set(!!value);
  }
}
