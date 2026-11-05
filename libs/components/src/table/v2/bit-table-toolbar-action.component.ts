import { ChangeDetectionStrategy, Component, booleanAttribute, input } from "@angular/core";

import { ButtonType } from "../../shared/button-like.abstraction";
import { BitwardenIcon } from "../../shared/icon";

/**
 * Declares an action for `bit-table-toolbar`. Renders nothing itself: the toolbar shows it as a
 * button beside the search, or as an item in its overflow menu once the row runs out of room.
 */
@Component({
  selector: "bit-table-toolbar-action",
  template: "",
  host: { style: "display: none" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitTableToolbarActionComponent {
  /** Called when the action is chosen, from either the button or the overflow menu. */
  readonly action = input.required<() => void>();

  /** Text for the button and its menu item. */
  readonly label = input.required<string>();

  /** Icon shown at the start of the button and its menu item. */
  readonly icon = input<BitwardenIcon>();

  /** The button's style while it's shown in the row. */
  readonly buttonType = input<ButtonType>("secondary");

  readonly disabled = input(false, { transform: booleanAttribute });

  /** Keeps the action in the row while others collapse into the menu. Only one action can be pinned. */
  readonly pinned = input(false, { transform: booleanAttribute });
}
