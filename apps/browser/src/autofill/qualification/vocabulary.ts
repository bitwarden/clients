import { FormKind, PageScenarioKind } from "./types";
import { ConfidenceBand } from "./types/classification";
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

// These thresholds are calibrated against `UNKNOWN_BASELINE_LOGIT = 1.0`
// (see `likelihood-ratios.ts`). After softmax, an "unknown" cell of mass ~0.27
// is the baseline; positive labels need to overcome that. If you move the
// baseline, move these together — a higher baseline raises the bar for every
// "is this a real classification?" check, and silently downgrades every
// confidence band. Don't tune one constant in isolation.
const NONE_FLOOR = 0.15;
const CERTAIN_FLOOR = 1.0;
const HIGH_FLOOR = 0.55;

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

export function toConfidenceBand(score: number, disqualified = false): ConfidenceBand {
  if (disqualified) {
    return "disqualified";
  }
  if (score >= CERTAIN_FLOOR) {
    return "certain";
  }
  if (score >= HIGH_FLOOR) {
    return "high";
  }
  if (score >= NONE_FLOOR) {
    return "low";
  }
  return "none";
}

export function isAboveMatchedFloor(score: number): boolean {
  return score >= NONE_FLOOR;
}

export function isAboveFormMatchedFloor(score: number): boolean {
  return score >= FORM_MATCHED_FLOOR;
}
