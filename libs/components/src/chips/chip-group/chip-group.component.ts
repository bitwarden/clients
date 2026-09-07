import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { OverflowItemDirective } from "../../overflow-list/overflow-item.directive";
import { OverflowListDirective } from "../../overflow-list/overflow-list.directive";
import { OverflowTriggerDirective } from "../../overflow-list/overflow-trigger.directive";
import { PopoverModule } from "../../popover";
import { PopoverPanelComponent } from "../../popover/popover-panel.component";
import { PopoverTriggerForDirective } from "../../popover/popover-trigger-for.directive";
import { TooltipDirective } from "../../tooltip/tooltip.directive";
import { ChipActionComponent } from "../chip-action";
import { BaseChipDirective } from "../shared/base-chip.directive";

/** A single action chip rendered by {@link ChipGroupComponent}. */
export type ChipGroupItem = {
  /**
   * Stable identifier for the thing the chip stands for — a collection id, a folder id, a filter
   * key. Carried through {@link ChipGroupComponent.chipSelect} so the consumer can act on the
   * activated chip without matching on its display text.
   */
  id: string;
  /** Text shown inside the chip. */
  label: string;
  /** Visual variant of the chip. Defaults to the chip's own default (`primary`). */
  variant?: ReturnType<BaseChipDirective["variant"]>;
  /** Leading icon shown inside the chip. */
  startIcon?: ReturnType<ChipActionComponent["startIcon"]>;
};

/**
 * Displays a collection of action chips in a horizontal row that doesn't wrap. Chips
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
 * Sizing is fully measurement-driven; the group does not take a `maxItems`
 * input. Resize the container and more or fewer chips become visible.
 */
@Component({
  selector: "bit-chip-group",
  templateUrl: "chip-group.component.html",
  imports: [
    ChipActionComponent,
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

  /**
   * Emits the activated chip, from either the visible row or the overflow popover. The whole
   * item is emitted rather than just its `id`, so consumers that filter by id and consumers
   * that need the label (a "Filtered by X" pill, say) are both served without a second lookup.
   */
  readonly chipSelect = output<ChipGroupItem>();

  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly list = viewChild.required(OverflowListDirective);
  private readonly popoverTrigger = viewChild.required(PopoverTriggerForDirective);
  private readonly overflowTrigger = viewChild.required(OverflowTriggerDirective);

  protected readonly overflow = computed(() => this.list().overflow());

  /** The hidden chips, in original order, rendered inside the popover. */
  protected readonly overflowChips = computed(() => {
    const chips = this.chips();
    return this.overflow()
      .map((i) => chips[i])
      .filter((chip) => chip != null);
  });

  constructor() {
    // Labels/variants change in place under `track $index`, so the item instances stay
    // the same and the list won't remeasure on its own.
    effect(() => {
      this.chips();
      this.size();
      this.list().remeasure({ reset: true });
    });

    // Every chip is a button, so the packing pass can pull the focused node out of the tab
    // order: a chip packed into the popover, or the "+N" trigger once nothing overflows
    // anymore. The browser drops focus on `document.body` when that happens, which loses
    // the user's place in the page. Hand focus to a control that survives the pass instead.
    effect(() => {
      const hidden = this.list().hiddenElements();
      const active = this.document.activeElement;
      if (!(active instanceof HTMLElement) || !hidden.has(active)) {
        return;
      }

      const target = this.focusFallback(hidden);
      // The fallback may still be hidden as this runs — revealing the trigger and hiding a
      // chip happen in the same pass — so focus it once the DOM reflects the new state.
      afterNextRender(() => target?.focus(), { injector: this.injector });
    });
  }

  /**
   * Where focus goes when the control holding it is about to be hidden: the "+N" trigger,
   * since it opens the popover that now holds the hidden chips, else the last chip left in
   * the row for when the trigger itself is what's going away.
   */
  private focusFallback(hidden: ReadonlySet<HTMLElement>): HTMLElement | undefined {
    const trigger = this.overflowTrigger().elementRef.nativeElement;
    if (!hidden.has(trigger)) {
      return trigger;
    }

    const items = this.list().items();
    const displayed = this.list().displayed();
    for (let i = displayed.length - 1; i >= 0; i--) {
      const el = items[displayed[i]]?.elementRef.nativeElement;
      if (el != null && !hidden.has(el)) {
        return el;
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
}
