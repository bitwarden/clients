import { ChangeDetectionStrategy, Component, booleanAttribute, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

/**
 * Declares a primary action in a `BulkActionsBarComponent`. This component renders no DOM of
 * its own — it's a data holder whose inputs the bar reads via `contentChildren` to render the
 * actual toolbar button itself. Projecting `<bit-bulk-action>` is how consumers describe each
 * action; the bar owns rendering, focus management, and overflow (in a follow-up).
 *
 * `icon` is required on primaries because every action in the toolbar row must have one — both
 * for the labeled row and for the compact icon-only mode it collapses into.
 */
@Component({
  selector: "bit-bulk-action",
  template: "",
  host: { style: "display: none" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkActionComponent {
  readonly action = input.required<() => void>();
  readonly label = input.required<string>();
  readonly icon = input.required<BitwardenIcon>();
  readonly disabled = input(false, { transform: booleanAttribute });
}
