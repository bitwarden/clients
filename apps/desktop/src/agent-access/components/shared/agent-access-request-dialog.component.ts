import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { DialogModule } from "@bitwarden/components";

import { AgentAccessConsequence } from "../../models/agent-access-consequence";

import { AgentAccessConsequenceComponent } from "./agent-access-consequence.component";
import {
  AgentAccessRequesterComponent,
  AgentAccessRequesterView,
} from "./agent-access-requester.component";

/**
 * The shell every Agent Access approval dialog composes onto (agent-access-design-spec.md §3.1).
 * Owns spacing and the fixed WHO → WHAT → WHICH order (spec §2): the requester block, the
 * consequence band, then `<ng-content>` for the dialog-specific body.
 *
 * ## The composition risk this resolves (spec §3.1)
 *
 * Six of the nine dialogs are `<form [bitSubmit]="submit" [formGroup]="f" bit-dialog>` — the
 * `<form>` element *is* the dialog, and footer `bitFormButton` buttons resolve `BitSubmitDirective`
 * through Angular's element-injector chain. This shell's `<bit-dialog>` is its *own* nested
 * element rather than an attribute on the consumer's `<form>`, and the footer is projected twice
 * (consumer → this shell's `[dialogFooter]` slot → `bit-dialog`'s own `[bitDialogFooter]` slot),
 * so the DI resolution risked breaking.
 *
 * It doesn't: Angular resolves a directive's element injectors by walking the DOM tree as
 * *authored in the declaring template*, not the tree the content is ultimately rendered into.
 * A footer button written inside `<form>...<app-agent-access-request-dialog>...<ng-container
 * dialogFooter>` is declared as a descendant of `<form>` in the consumer's own template, so the
 * injector walk still reaches `BitSubmitDirective` on `<form>` regardless of how many layers of
 * `<ng-content>` re-project it into this component's and `bit-dialog`'s internal DOM. Proven by a
 * real rendered `TestBed` spec in `agent-access-request-dialog.component.spec.ts` — see that file
 * for what was checked. Both the form-wrapped and non-form (`<bit-dialog>`-only, using
 * `[bitAction]` instead) consumer shapes are exercised there.
 */
@Component({
  selector: "app-agent-access-request-dialog",
  templateUrl: "./agent-access-request-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, AgentAccessRequesterComponent, AgentAccessConsequenceComponent],
})
export class AgentAccessRequestDialogComponent {
  readonly dialogTitle = input.required<string>();
  readonly requester = input.required<AgentAccessRequesterView>();
  readonly grade = input.required<AgentAccessConsequence>();

  /** One sentence, already localized, naming precisely what crosses the boundary. */
  readonly consequenceSummary = input.required<string>();

  /** Optional second line, muted, for caveats — e.g. a truncation notice. */
  readonly consequenceDetail = input<string>();

  /**
   * Passthrough to `bit-dialog`'s own `dialogSize` input
   * (`libs/components/src/dialog/dialog/dialog.component.ts`). Mirrored inline rather than
   * imported because that library's `DialogSize` type isn't exported — keep this union in sync
   * with the source if it ever changes. Defaults to `bit-dialog`'s own default ("default"), so
   * every existing shell consumer renders unchanged unless it opts in; dialogs with wide tabular
   * content (e.g. `project-list-request`'s 3-column table, `project-secrets-request`'s name
   * list) can pass `"large"`.
   */
  readonly dialogSize = input<"small" | "default" | "large">("default");
}
