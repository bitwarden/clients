import { FieldRole } from "./field-role";
import { FormCategory } from "./form-category";

export type ConfidenceBand = "certain" | "high" | "low" | "none" | "disqualified";

export type RoleScore = {
  role: FieldRole;
  score: number;
};

export type CategoryScore = {
  category: FormCategory;
  score: number;
};

export type FieldClassification = {
  /**
   * Every role this field qualifies for. The adapter's role-based boolean
   * methods read this set — `isUsernameField` returns `matchedRoles.has(Username)`.
   * Engines that do mutual-exclusion dispatch typically populate this with a
   * single role; engines whose predicates overlap (such as the legacy bridge)
   * may include multiple.
   */
  matchedRoles: ReadonlySet<FieldRole>;
  /**
   * Form contexts this field qualifies as a member of. Distinct from the
   * form's own `matchedCategories` — this records per-field form-context
   * predicates like `isFieldForLoginForm`, which return true only when the
   * field is both of an appropriate role and embedded in a matching form.
   * Engines that don't model per-field form context leave this empty.
   */
  matchedFormContexts: ReadonlySet<FormCategory>;
  /**
   * The role the engine selected as this field's primary classification, if
   * any. Engines that do mutual-exclusion dispatch (e.g. a future scoring
   * engine) populate this with their dispatch winner. Engines without
   * dispatch (the legacy bridge) populate it with the first role inserted
   * into `matchedRoles` — which reflects predicate iteration order, not any
   * notion of "best." Consumers that need the legacy-faithful boolean should
   * read `matchedRoles.has(role)`, not `topRole === role`.
   */
  topRole: FieldRole | null;
  confidence: ConfidenceBand;
  score: number;
  allScores: ReadonlyArray<RoleScore>;
  trace?: unknown;
};

export type FormClassification = {
  matchedCategories: ReadonlySet<FormCategory>;
  topCategory: FormCategory | null;
  confidence: ConfidenceBand;
  score: number;
  allScores: ReadonlyArray<CategoryScore>;
  trace?: unknown;
};
