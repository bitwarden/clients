import { FieldRole } from "./types/field-role";

export {
  ConfidenceBand,
  CategoryScore,
  FieldClassification,
  FormClassification,
  RoleScore,
} from "./types/classification";
export { FieldRole };
export { FormCategory } from "./types/form-category";
export { PageScenario } from "./types/page-scenario";
export { PageQualification, QualificationEngine } from "./abstractions/qualification-engine";

// Engine-internal alias for the shipped FieldRole. The engine emits FieldRole
// directly in classification distributions and trace structures — the field
// side has only two genuine renames (`password` → `currentPassword`,
// `oneTimeCode` → `totp`) and 25 byte-identical pass-throughs, so a parallel
// FieldKind vocabulary would be synonym tax on the reader. UpdateCurrentPassword
// is the one FieldRole the engine doesn't score directly — it is added in
// projection when a CurrentPassword field appears in an update-flow context.
//
// The form side keeps a parallel FormKind/FormCategory split because that
// boundary genuinely hides engine internals (account-update, account-recovery,
// account-username-recovery, signup have no public FormCategory).

export const FormKind = Object.freeze({
  AccountLogin: "account-login",
  AccountCreation: "account-creation",
  AccountUpdate: "account-update",
  AccountRecovery: "account-recovery",
  AccountUsernameRecovery: "account-username-recovery",
  PaymentCard: "payment-card",
  Identity: "identity",
  Signup: "signup",
} as const);
export type FormKind = (typeof FormKind)[keyof typeof FormKind];

export const PageScenarioKind = Object.freeze({
  LoginPage: "login-page",
  SignupPage: "signup-page",
  UpdatePage: "update-page",
  RecoveryPage: "recovery-page",
  CheckoutPage: "checkout-page",
  ProfilePage: "profile-page",
  Mixed: "mixed",
} as const);
export type PageScenarioKind = (typeof PageScenarioKind)[keyof typeof PageScenarioKind];

export type Distribution<K extends string> = Readonly<Partial<Record<K | "unknown", number>>>;

export type ClusterMembership = {
  readonly id: string;
  readonly shape: "split-by-position" | "split-by-role";
  readonly position?: number;
  readonly total?: number;
  readonly role?: string;
};

export type AmbientSlotName =
  | "formAttrs"
  | "submitButtonText"
  | "headings"
  | "pageTitle"
  | "urlPath";

export type MatcherOutcome = "satisfied" | "failed-min" | "failed-max" | "vetoed";

export type ClassificationReason =
  | {
      readonly type: "field-cue";
      readonly contributedTo: FieldRole;
      readonly fieldOpid: string;
      readonly slot: string;
      readonly matchedToken: string;
      readonly weight: number;
    }
  | {
      readonly type: "ambient-cue";
      readonly contributedTo: FormKind;
      readonly slot: AmbientSlotName;
      readonly raw: string;
      readonly matchedToken: string;
    }
  | {
      readonly type: "archetype-matcher";
      readonly contributedTo: FormKind;
      readonly outcome: MatcherOutcome;
      readonly matcherKinds: ReadonlyArray<FieldRole>;
      readonly matchedFieldOpids: ReadonlyArray<string>;
      readonly min: number;
      readonly max?: number;
      readonly role: "required" | "optional" | "forbidden";
    };

export type ScoringEngineTrace = {
  readonly engine: "scoring";
  readonly internalKind: FieldRole | FormKind | "unknown";
  readonly cluster?: ClusterMembership;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};
