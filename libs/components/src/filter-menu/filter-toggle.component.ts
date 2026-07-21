import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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

import {
  FILTER_CONTROL,
  FILTER_HOST,
  FILTER_PRESENTER,
  FilterControl,
  FilterPresenter,
} from "./filter-tokens";

/**
 * A single on/off filter chip — no menu. Use it when a filter is one element
 * rather than a category (e.g. "Favorites"). Clicking toggles it; its icon fills
 * while active. Its value is a boolean, exposed under its `key` via
 * {@link FILTER_CONTROL}. Projected into a filterable surface (e.g. `bit-table-v2`)
 * it resolves the surface's {@link FILTER_HOST} by DI and self-registers, so its
 * value joins the host's `filterValues`; inert when there's no host.
 *
 * @example
 * ```html
 * <bit-filter-toggle key="favorites" label="Favorites" icon="bwi-star"></bit-filter-toggle>
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
export class FilterToggleComponent implements FilterControl, FilterPresenter, OnInit {
  /** The chip's key — the property its boolean value occupies in the host's `filterValues`. */
  readonly key = input.required<string>();

  /** The chip's label. */
  readonly label = input.required<string>();

  /** Leading icon; shown filled (`-f` variant) while active when available. */
  readonly icon = input<BitwardenIcon>();

  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  /** The filterable surface this chip is projected into, if any. */
  private readonly filterHost = inject(FILTER_HOST, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

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

  ngOnInit(): void {
    // Register with the host (if any) once inputs like `key` have resolved, not in
    // the constructor: the host seeds initial filters off `key`, which isn't set
    // yet at construction. Inert when there's no host (used outside a table).
    const host = this.filterHost;
    if (!host) {
      return;
    }
    host.registerFilter(this);
    this.destroyRef.onDestroy(() => host.unregisterFilter(this));
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
