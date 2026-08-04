import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  model,
  Signal,
  signal,
} from "@angular/core";

import { safeProvider } from "@bitwarden/ui-common";

import { AccordionComponent, AccordionSize, AccordionVariant } from "../accordion";
import { BitwardenIcon } from "../shared/icon";

import { ItemGroupComponent } from "./item-group.component";

/**
 * Convenience wrapper that renders a joined segmented card of items inside a `bit-accordion`.
 * Purely compositional — all accordion behavior (ARIA, single-select coordination, two-way `open`)
 * comes from `bit-accordion`.
 *
 * The projected items are authored inside this component, so their element injector resolves
 * `ItemGroupComponent` here rather than at the segmented card in this component's view (Angular DI
 * follows the declaration tree, not the projection tree). We therefore alias `ItemGroupComponent`
 * to this component with `joined` fixed to `true`, so each `bit-item` drops its own border and the
 * rows read as one joined card.
 */
@Component({
  selector: "bit-item-group-accordion",
  imports: [AccordionComponent],
  templateUrl: "./item-group-accordion.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    safeProvider({
      provide: ItemGroupComponent,
      useExisting: forwardRef(() => ItemGroupAccordionComponent),
    }),
  ],
  host: {
    class: "tw-block",
  },
})
export class ItemGroupAccordionComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly open = model<boolean>(false);
  readonly startIcon = input<BitwardenIcon>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly size = input<AccordionSize>("default");
  readonly variant = input<AccordionVariant>("default");

  /**
   * Satisfies the `ItemGroupComponent` contract that projected `bit-item`s inject. The accordion
   * always renders its items joined, so this is fixed to `true`.
   */
  readonly joined: Signal<boolean> = signal(true);
}
