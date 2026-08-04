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
 * Renders items joined inside a `bit-accordion` — a divider row separates them so they read as one
 * card. Aliases `ItemGroupComponent` to itself with `joined` fixed to `true` so projected
 * `bit-item`s inject it and drop their own borders.
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
