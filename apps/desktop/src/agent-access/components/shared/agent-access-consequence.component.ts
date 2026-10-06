import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { IconComponent, TypographyModule } from "@bitwarden/components";
import type { BitwardenIcon } from "@bitwarden/components";

import { AgentAccessConsequence } from "../../models/agent-access-consequence";

interface ConsequenceStyle {
  /** Tailwind classes for the band's wrapper — left rule, background, and text/icon colour.
   *  Every class here is verified to exist in `libs/components/tailwind.config.base.js`
   *  (agent-access-design-spec.md §2.2 — no invented tokens, no arbitrary values). */
  readonly wrapper: readonly string[];
  readonly icon: BitwardenIcon;
}

/** The two grades that actually cost the user something — a secret value leaving the device, or
 *  an irreversible removal. Everything below (the filled band, its icon, its colour) exists only
 *  for these two; `Metadata` and `Change` are deliberately absent from this type, not merely
 *  unused, so the compiler — not just the reader — enforces that they can never pick up a style. */
type FilledConsequenceGrade =
  typeof AgentAccessConsequence.Disclose | typeof AgentAccessConsequence.Destroy;

function isFilledGrade(grade: AgentAccessConsequence): grade is FilledConsequenceGrade {
  return grade === AgentAccessConsequence.Disclose || grade === AgentAccessConsequence.Destroy;
}

/**
 * Filled-band token mapping, restricted to `Disclose`/`Destroy` per
 * agent-access-design-spec.md §7.5.1 (supersedes §2.2, which filled all four grades). Live design
 * review verdict: a warning on four dialogs out of nine is a signal; on all nine it is wallpaper.
 * `Metadata` and `Change` render the identical sentence as plain muted text instead — see the
 * template's `@else` branch. Left rule uses the `tw-border-0 tw-border-s tw-border-solid` idiom
 * already used in this codebase (e.g. `stepper.component.html`), widened to `tw-border-s-4`, and
 * kept logical (`-s-`, not `-l-`) so RTL still renders the rule on the correct edge.
 */
const CONSEQUENCE_STYLES: Record<FilledConsequenceGrade, ConsequenceStyle> = {
  [AgentAccessConsequence.Disclose]: {
    wrapper: ["tw-border-border-warning", "tw-bg-bg-warning-soft", "tw-text-fg-warning-strong"],
    icon: "bwi-key",
  },
  [AgentAccessConsequence.Destroy]: {
    wrapper: ["tw-border-border-danger", "tw-bg-bg-danger-soft", "tw-text-fg-danger-strong"],
    icon: "bwi-trash",
  },
};

/**
 * WHAT happens if I say yes — the signature element of the Agent Access dialog family
 * (agent-access-design-spec.md §2, §2.2, §7.5.1). One sentence, its rendering derived from a
 * consequence grade rather than chosen per dialog, so the family stops treating "list project
 * names" and "release every secret in a project" identically (spec §1, fault 2 — "everything is
 * a warning"). Only `Disclose` and `Destroy` — the two grades that cost the user something — get
 * the filled, left-ruled, icon-bearing band; `Metadata` and `Change` render the same sentence as
 * plain muted body text in the normal flow. Keep every other surface quiet so the filled band, on
 * the dialogs that still have one, lands.
 */
@Component({
  selector: "app-agent-access-consequence",
  templateUrl: "./agent-access-consequence.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TypographyModule],
})
export class AgentAccessConsequenceComponent {
  readonly grade = input.required<AgentAccessConsequence>();

  /** One sentence, already localized, naming precisely what crosses the boundary. */
  readonly summary = input.required<string>();

  /** Optional second line, muted, for caveats — e.g. a truncation notice. */
  readonly detail = input<string>();

  /** `undefined` for `Metadata`/`Change` — the template's `@else` branch reads that absence as
   *  "render plain" rather than checking the grade a second time. */
  protected readonly style = computed<ConsequenceStyle | undefined>(() => {
    const grade = this.grade();
    return isFilledGrade(grade) ? CONSEQUENCE_STYLES[grade] : undefined;
  });

  protected readonly wrapperClasses = computed(() => [
    "tw-flex",
    "tw-items-start",
    "tw-gap-2",
    "tw-rounded-md",
    "tw-border-0",
    "tw-border-s-4",
    "tw-border-solid",
    "tw-p-3",
    ...(this.style()?.wrapper ?? []),
  ]);
}
