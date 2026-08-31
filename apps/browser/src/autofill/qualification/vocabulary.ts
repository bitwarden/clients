import { bandFor } from "./classification";
import { FormKind, PageScenarioKind } from "./types";
import { FieldRole } from "./types/field-role";
import { FormCategory } from "./types/form-category";
import { PageScenario } from "./types/page-scenario";

const formKindToCategory: Readonly<Record<FormKind, FormCategory | null>> = Object.freeze({
  "account-login": FormCategory.Login,
  "account-creation": FormCategory.AccountCreation,
  "account-update": null,
  "account-recovery": null,
  "account-username-recovery": null,
  "payment-card": FormCategory.CreditCard,
  identity: FormCategory.Identity,
  signup: null,
});

const scenarioKindToShipped: Readonly<Record<PageScenarioKind, PageScenario | null>> =
  Object.freeze({
    "login-page": PageScenario.LoginPage,
    "signup-page": PageScenario.RegistrationPage,
    "update-page": PageScenario.PasswordChangePage,
    "recovery-page": PageScenario.PasswordChangePage,
    "checkout-page": PageScenario.CheckoutPage,
    "profile-page": PageScenario.ProfilePage,
    mixed: null,
  });

export function toFormCategory(kind: FormKind): FormCategory | null {
  return formKindToCategory[kind];
}

export function toPageScenario(kind: PageScenarioKind): PageScenario | null {
  return scenarioKindToShipped[kind];
}

// The engine emits every shipped FieldRole. UpdateCurrentPassword is derived
// in projection from a CurrentPassword field's context; the rest come from
// direct cue-table scoring.
export const SCORING_ENGINE_COVERED_ROLES: ReadonlySet<FieldRole> = Object.freeze(
  new Set<FieldRole>(Object.values(FieldRole)),
);

export const SCORING_ENGINE_COVERED_CATEGORIES: ReadonlySet<FormCategory> = Object.freeze(
  new Set(Object.values(formKindToCategory).filter((c): c is FormCategory => c !== null)),
);

// `matchedCategories` on a FormClassification requires more evidence than the field-level
// matched-floor — partial-required-hit (one of two required matchers firing, score 0.5) is
// not enough to claim "this form is that archetype." The threshold catches the minimum
// "all required matchers satisfied" score for any of the engine's archetypes:
//
//   1-required archetype, all satisfied = 1*0.5 + 0.3 completeness = 0.8
//   2-required archetype, all satisfied = 2*0.5 + 0.3 completeness = 1.3
//
// 0.65 is a touch below 0.8 so a fully-satisfied 1-required archetype with no ambient
// always qualifies, while a 2-required archetype with only one matcher firing (score 0.5)
// is correctly excluded.
const FORM_MATCHED_FLOOR = 0.65;

/**
 * Whether a score clears the bar for "the engine actually claims this label."
 *
 * Expressed through {@link bandFor} rather than against a threshold of its own.
 * The band cutoffs are calibrated against `UNKNOWN_BASELINE_LOGIT = 1.0` (see
 * `likelihood-ratios.ts`) — after softmax, an "unknown" cell of mass ~0.27 is
 * the baseline, and positive labels have to overcome it. A second copy of the
 * lowest cutoff here would be a second thing to remember when that baseline
 * moves, and the two would drift apart silently.
 */
export function isAboveMatchedFloor(score: number): boolean {
  return bandFor(score) !== "none";
}

export function isAboveFormMatchedFloor(score: number): boolean {
  return score >= FORM_MATCHED_FLOOR;
}
