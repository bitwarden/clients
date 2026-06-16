import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
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

import { FILTER_CONTROL, FILTER_PRESENTER, FilterControl, FilterPresenter } from "./filter-tokens";

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
  providers: [
    { provide: FILTER_CONTROL, useExisting: forwardRef(() => FilterToggleComponent) },
    { provide: FILTER_PRESENTER, useExisting: forwardRef(() => FilterToggleComponent) },
  ],
  hostDirectives: [{ directive: BaseChipDirective, inputs: ["disabled", "size", "fullWidth"] }],
})
export class FilterToggleComponent implements FilterControl, FilterPresenter {
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

  /** @see FilterPresenter.summary — a toggle has no per-option summary. */
  readonly summary = computed(() => "");

  /** @see FilterPresenter.optionsTemplate — a toggle has no drill-in; it flips in place. */
  readonly optionsTemplate = computed<TemplateRef<unknown> | undefined>(() => undefined);

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

  /** Flips the toggle. Wired to the chip click and the responsive dialog's row. */
  flip(): void {
    if (this.disabled()) {
      return;
    }
    this._value.update((v) => !v);
  }

  /** @see FilterPresenter.clear */
  clear(): void {
    this._value.set(false);
  }

  setValue(value: unknown): void {
    this._value.set(!!value);
  }
}
