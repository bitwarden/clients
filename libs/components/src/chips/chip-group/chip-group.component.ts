import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
  viewChildren,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { OverflowItemDirective } from "../../overflow-list/overflow-item.directive";
import { OverflowListDirective } from "../../overflow-list/overflow-list.directive";
import { OverflowTriggerDirective } from "../../overflow-list/overflow-trigger.directive";
import { PopoverModule } from "../../popover";
import { PopoverPanelComponent } from "../../popover/popover-panel.component";
import { PopoverTriggerForDirective } from "../../popover/popover-trigger-for.directive";
import { TooltipDirective } from "../../tooltip/tooltip.directive";
import { ChipComponent } from "../chip";
import { ChipActionComponent } from "../chip-action";
import { BaseChipDirective } from "../shared/base-chip.directive";

/** A single chip rendered by {@link ChipGroupComponent}. */
export type ChipGroupItem = {
  /**
   * Stable identifier for the thing the chip stands for — a collection id, a folder id, a filter
   * key. Carried through `chipSelect` and `chipDismiss` so the consumer can act on the chip
   * without matching on its display text.
   */
  id: string;
  /** Text shown inside the chip. */
  label: string;
  /** In a dismissible group, names the dismiss button and fills the tooltip. Defaults to `label`. */
  accessibleName?: string;
  /** Visual variant of the chip. Defaults to the chip's own default (`primary`). Ignored when dismissible. */
  variant?: ReturnType<BaseChipDirective["variant"]>;
  /** Leading icon shown inside the chip. */
  startIcon?: ReturnType<ChipActionComponent["startIcon"]>;
};

/**
 * Displays a collection of chips in a horizontal row that doesn't wrap. Chips
 * that don't fit the container width are hidden via `bitOverflowList`, and a
 * "+N" action chip is rendered at the end. Clicking the chip opens a popover
 * that lists the hidden chips, which stay activatable there.
 *
 * Chips are passed as data through the `chips` input; the group renders both
 * the row and the popover from that data, so variant, icon, and label are
 * described per-item rather than authored as markup. The first chip is pinned,
 * so at least one chip is always visible regardless of available width.
 *
 * Activating any chip — in the row or in the overflow popover — emits it through
 * {@link chipSelect}. The group holds no selection state of its own; it reports the
 * activation and leaves the consequence (filtering, navigating) to the consumer.
 *
 * With `dismissible`, chips render as input chips whose only control is a dismiss button,
 * emitting through {@link chipDismiss} instead. Removing the chip is likewise left to the consumer.
 *
 * Sizing is fully measurement-driven; the group does not take a `maxItems`
 * input. Resize the container and more or fewer chips become visible.
 */
@Component({
  selector: "bit-chip-group",
  templateUrl: "chip-group.component.html",
  imports: [
    ChipActionComponent,
    ChipComponent,
    PopoverModule,
    PopoverPanelComponent,
    OverflowItemDirective,
    OverflowListDirective,
    OverflowTriggerDirective,
    TooltipDirective,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipGroupComponent {
  readonly chips = input<ChipGroupItem[]>([]);

  /**
   * Size applied to every chip in the group, including the overflow "+N" chip. Group-level
   * rather than per-item, since a row of mismatched chip heights isn't a supported design.
   */
  readonly size = input<ReturnType<BaseChipDirective["size"]>>("large");

  /**
   * Accessible name for the group as a whole, e.g. "Shared folders". Individual chips are
   * named by their own label, which on its own doesn't say what the collection of them is.
   * Omit when a nearby heading or column header already supplies that context.
   */
  readonly accessibleName = input<string>();

  /** Renders every chip with a dismiss button, emitting through {@link chipDismiss}. */
  readonly dismissible = input(false, { transform: booleanAttribute });

  /**
   * Emits the activated chip, from either the visible row or the overflow popover. The whole
   * item is emitted rather than just its `id`, so consumers that filter by id and consumers
   * that need the label (a "Filtered by X" pill, say) are both served without a second lookup.
   */
  readonly chipSelect = output<ChipGroupItem>();

  /** Emits the chip whose dismiss button was activated, from either the row or the popover. */
  readonly chipDismiss = output<ChipGroupItem>();

  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly list = viewChild.required(OverflowListDirective);
  private readonly popoverTrigger = viewChild.required(PopoverTriggerForDirective);
  private readonly overflowTrigger = viewChild.required(OverflowTriggerDirective);
  private readonly rowChipComponents = viewChildren("rowChip", { read: ChipComponent });
  private readonly popoverChipComponents = viewChildren("popoverChip", { read: ChipComponent });

  protected readonly overflow = computed(() => this.list().overflow());

  /** The hidden chips, in original order, rendered inside the popover. */
  protected readonly overflowChips = computed(() => {
    const chips = this.chips();
    return this.overflow()
      .map((i) => chips[i])
      .filter((chip) => chip != null);
  });

  /** Held through the measurement reset after a removal, which briefly empties `overflowChips`. */
  protected readonly popoverChips = linkedSignal({
    source: () => ({ next: this.overflowChips(), measured: this.list().measured() }),
    computation: ({ next, measured }, prev?: { value: ChipGroupItem[] }) => {
      if (measured || prev == null) {
        return next;
      }
      const ids = new Set(this.chips().map((chip) => chip.id));
      return prev.value.filter((chip) => ids.has(chip.id));
    },
  });

  constructor() {
    // Dismissing a chip can free enough room that nothing overflows anymore, leaving an open
    // popover with nothing to list. Close it and hand focus back to the row.
    effect(() => {
      if (
        !this.popoverTrigger().popoverOpen() ||
        !this.list().measured() ||
        this.overflow().length > 0
      ) {
        return;
      }
      untracked(() => this.popoverTrigger().closePopover());
      afterNextRender(() => this.focusFallback()?.focus(), { injector: this.injector });
    });

    // Labels/variants change in place under `track $index`, so the item instances stay
    // the same and the list won't remeasure on its own.
    effect(() => {
      this.chips();
      this.size();
      this.list().remeasure({ reset: true });
    });

    // Every chip holds a button, so the packing pass can pull the focused node out of the tab
    // order: a chip packed into the popover, or the "+N" trigger once nothing overflows
    // anymore. The browser drops focus on `document.body` when that happens, which loses
    // the user's place in the page. Hand focus to a control that survives the pass instead.
    effect(() => {
      const hidden = this.list().hiddenElements();
      const active = this.document.activeElement;
      // A dismissible chip's focus sits on its inner dismiss button, not the hidden host.
      if (!(active instanceof HTMLElement) || ![...hidden].some((el) => el.contains(active))) {
        return;
      }

      // Pick the fallback after render: the trigger reveal and chip hide land in the same pass,
      // and a removed chip stays in `items()` until then.
      afterNextRender(() => this.focusFallback()?.focus(), {
        injector: this.injector,
      });
    });
  }

  /**
   * Where focus goes when the control holding it is about to be hidden: the "+N" trigger,
   * since it opens the popover that now holds the hidden chips, else the last chip left in
   * the row for when the trigger itself is what's going away.
   */
  private focusFallback(): HTMLElement | undefined {
    const hidden = this.list().hiddenElements();
    const trigger = this.overflowTrigger().elementRef.nativeElement;
    if (!hidden.has(trigger)) {
      return trigger;
    }

    const items = this.list().items();
    const displayed = this.list().displayed();
    for (let i = displayed.length - 1; i >= 0; i--) {
      const el = items[displayed[i]]?.elementRef.nativeElement;
      if (el != null && !hidden.has(el)) {
        return this.dismissible() ? this.rowChipComponents()[displayed[i]]?.getFocusTarget() : el;
      }
    }
    return undefined;
  }

  /**
   * Activating an overflow chip closes the popover first: the popover is modal, and leaving it
   * open over a list the consumer is about to filter would strand focus in stale content.
   */
  protected selectOverflowChip(chip: ChipGroupItem) {
    this.popoverTrigger().closePopover();
    this.chipSelect.emit(chip);
  }

  /**
   * Dismissing keeps the popover open so several chips can be cleared in a row; only the last
   * one closes it. Focus moves to the chip that took the dismissed one's place.
   */
  protected dismissOverflowChip(chip: ChipGroupItem) {
    const listed = this.popoverChips();
    const index = listed.indexOf(chip);
    if (listed.length <= 1) {
      this.popoverTrigger().closePopover();
    } else {
      afterNextRender(
        () => {
          const chips = this.popoverChipComponents();
          chips[Math.min(index, chips.length - 1)]?.getFocusTarget().focus();
        },
        { injector: this.injector },
      );
    }
    this.chipDismiss.emit(chip);
  }
}
