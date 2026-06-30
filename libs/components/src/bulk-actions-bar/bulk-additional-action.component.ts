import { ChangeDetectionStrategy, Component, booleanAttribute, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

/**
 * Declares an action that lives only in the bar's "Additional actions" menu (never in the
 * toolbar row). Like `BulkActionComponent`, this renders no DOM of its own — the bar reads its
 * inputs via `contentChildren` and renders the corresponding `<button bitMenuItem>` inside its
 * own `<bit-menu>`.
 *
 * `icon` is **optional** here (unlike on `bit-bulk-action`) because menu items can be label-only
 * — there's no compact icon-fallback mode for the menu.
 */
@Component({
  selector: "bit-bulk-additional-action",
  template: "",
  host: { style: "display: none" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkAdditionalActionComponent {
  readonly action = input.required<() => void>();
  readonly label = input.required<string>();
  readonly icon = input<BitwardenIcon>();
  readonly disabled = input(false, { transform: booleanAttribute });
}
