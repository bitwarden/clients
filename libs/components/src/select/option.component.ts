import { ChangeDetectionStrategy, Component, booleanAttribute, input } from "@angular/core";

import { IconTileOptions } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";

import { MappedOptionComponent } from "./option";

@Component({
  selector: "bit-option",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-template><ng-content></ng-content></ng-template>`,
})
export class OptionComponent<T = unknown> implements MappedOptionComponent<T> {
  readonly icon = input<BitwardenIcon>();

  /**
   * Renders a `bit-icon-tile` in place of the plain `icon`. Takes precedence when both are set.
   * The tile is always rendered at the `xs` size so all options line up.
   */
  readonly iconTile = input<IconTileOptions>();

  readonly value = input.required<T>();

  readonly label = input.required<string>();

  readonly description = input<string>();

  readonly disabled = input(undefined, { transform: booleanAttribute });
}
