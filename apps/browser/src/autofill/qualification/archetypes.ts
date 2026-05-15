import { argmax, bandFor } from "./classification";
import { AmbientSignals, ClassifiedField, FormClusterUnit } from "./internal";
import {
  AmbientSlotName,
  ClassificationReason,
  ConfidenceBand,
  FieldRole,
  FormKind,
  MatcherOutcome,
} from "./types";

export type RoleArityMatcher = {
  readonly kinds: ReadonlyArray<FieldRole>;
  readonly minBand: ConfidenceBand;
  readonly requireViewable: boolean;
  readonly min: number;
  readonly max?: number;
};

export type ScoreResult = {
  readonly score: number;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};

export type AmbientPriorResult = {
  readonly boost: number;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};

export type FormArchetype = {
  readonly kind: FormKind;
  readonly required: ReadonlyArray<RoleArityMatcher>;
  readonly optional: ReadonlyArray<RoleArityMatcher>;
  readonly forbidden: ReadonlyArray<RoleArityMatcher>;
  score(cluster: FormClusterUnit): ScoreResult;
  ambientPrior(ambient: AmbientSignals): AmbientPriorResult;
};

export const PER_SLOT_AMBIENT_BOOST = 0.2;
export const ALL_REQUIRED_BONUS = 0.3;

const LOGIN_AMBIENT_TOKENS: ReadonlyArray<string> = ["signin", "login", "loginform"];

const CREATION_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "signup",
  "register",
  "createaccount",
  "createyouraccount",
  "newaccount",
  "joinnow",
  "getstarted",
];

const UPDATE_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "changepassword",
  "updatepassword",
  "setnewpassword",
  "changeyourpassword",
  "passwordsettings",
];

const RECOVERY_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "forgotpassword",
  "forgotyourpassword",
  "resetpassword",
  "resetyourpassword",
  "passwordreset",
  "passwordrecovery",
  "recoverpassword",
  "recoveraccount",
];

const PAYMENT_CARD_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "checkout",
  "creditcard",
  "billingdetails",
  "billinginformation",
  "paymentdetails",
  "paymentinformation",
  "paymentmethod",
];

const IDENTITY_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "profile",
  "shippingaddress",
  "billingaddress",
  "contactinformation",
  "contactdetails",
  "personalinformation",
  "personaldetails",
  "yourdetails",
  "shippinginformation",
];

const SIGNUP_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "subscribe",
  "newsletter",
  "joinourlist",
  "joinmailing",
  "stayintouch",
  "stayinformed",
  "getourupdates",
  "joinnow",
];

const USERNAME_RECOVERY_AMBIENT_TOKENS: ReadonlyArray<string> = [
  "forgotusername",
  "forgotyourusername",
  "recoverusername",
  "findyouraccount",
  "findaccount",
  "lookupaccount",
];

const REQUIRED_SCORE_WEIGHT = 0.5;
const OPTIONAL_SCORE_WEIGHT = 0.1;

const accountLoginRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 1, max: 1 },
  { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 1, max: 1 },
];

const accountLoginOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

const accountLoginForbidden: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 },
];

const accountCreationRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 },
  { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 1, max: 2 },
];

const accountCreationOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

const accountCreationForbidden: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 },
];

const accountUpdateRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 1, max: 1 },
  { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 },
];

const accountUpdateOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

const accountUpdateForbidden: ReadonlyArray<RoleArityMatcher> = [];

const accountRecoveryRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 },
];

const accountRecoveryOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

const accountRecoveryForbidden: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 },
];

const paymentCardRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["cardNumber"], minBand: "high", requireViewable: true, min: 1, max: 1 },
  {
    kinds: ["cardExpirationDate", "cardExpirationMonth", "cardExpirationYear"],
    minBand: "high",
    requireViewable: true,
    min: 1,
    max: 3,
  },
];

const paymentCardOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["cardholderName"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["cardCvv"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

// Intentionally empty: positive card evidence (cardNumber autocomplete, etc.) is decisive
// enough that we don't need to veto on the presence of password fields. A combined
// "create account + checkout" form genuinely is both `AccountCreation` *and* `PaymentCard`;
// allowing the payment-card archetype to match alongside an auth archetype is the right
// shape for matchedCategories.
const paymentCardForbidden: ReadonlyArray<RoleArityMatcher> = [];

// `identity` archetype: a profile / address / contact form. Requires at least one
// "name-shape" field (any of the name variants) and at least one "address-shape"
// field (street address, city, state, postal code, country). Optional: phone,
// email, company, etc. No forbidden — identity forms can coexist with checkout
// (which is the common case: shipping address + payment card on one page).
const identityRequired: ReadonlyArray<RoleArityMatcher> = [
  {
    kinds: ["identityFirstName", "identityLastName", "identityFullName"],
    minBand: "high",
    requireViewable: true,
    min: 1,
    max: 3,
  },
  {
    kinds: [
      "identityAddress1",
      "identityCity",
      "identityState",
      "identityPostalCode",
      "identityCountry",
    ],
    minBand: "high",
    requireViewable: true,
    min: 1,
    max: 5,
  },
];

const identityOptional: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["identityTitle"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityMiddleName"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityAddress2"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityAddress3"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityCompany"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityPhone"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  { kinds: ["identityEmail", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
];

const identityForbidden: ReadonlyArray<RoleArityMatcher> = [];

// `signup` (newsletter / mailing-list) archetype: lightweight form with email
// and maybe name(s). NOT account-creation — no password field involved.
// Distinguishes from account-creation primarily by absence of password fields.
const signupRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["email"], minBand: "high", requireViewable: true, min: 1, max: 1 },
];

const signupOptional: ReadonlyArray<RoleArityMatcher> = [
  {
    kinds: ["identityFirstName", "identityLastName", "identityFullName"],
    minBand: "high",
    requireViewable: true,
    min: 0,
    max: 3,
  },
];

const signupForbidden: ReadonlyArray<RoleArityMatcher> = [
  {
    kinds: ["currentPassword", "newPassword"],
    minBand: "high",
    requireViewable: true,
    min: 0,
    max: 0,
  },
];

// `account-username-recovery` archetype: a "forgot username" form. Just email,
// no password. Distinguishes from `signup` archetype by ambient signals.
const usernameRecoveryRequired: ReadonlyArray<RoleArityMatcher> = [
  { kinds: ["email"], minBand: "high", requireViewable: true, min: 1, max: 1 },
];

const usernameRecoveryOptional: ReadonlyArray<RoleArityMatcher> = [];

const usernameRecoveryForbidden: ReadonlyArray<RoleArityMatcher> = [
  {
    kinds: ["currentPassword", "newPassword"],
    minBand: "high",
    requireViewable: true,
    min: 0,
    max: 0,
  },
];

function scoreArchetype(
  cluster: FormClusterUnit,
  kind: FormKind,
  required: ReadonlyArray<RoleArityMatcher>,
  optional: ReadonlyArray<RoleArityMatcher>,
  forbidden: ReadonlyArray<RoleArityMatcher>,
): ScoreResult {
  const reasons: ClassificationReason[] = [];
  let vetoed = false;
  for (const matcher of forbidden) {
    const result = evaluateMatcher(matcher, cluster.members, kind, "forbidden");
    reasons.push(result.reason);
    if (!result.satisfied) {
      vetoed = true;
    }
  }
  if (vetoed) {
    return { score: 0, reasons };
  }
  let requiredHits = 0;
  for (const matcher of required) {
    const result = evaluateMatcher(matcher, cluster.members, kind, "required");
    reasons.push(result.reason);
    if (result.satisfied) {
      requiredHits += 1;
    }
  }
  let optionalHits = 0;
  for (const matcher of optional) {
    const result = evaluateMatcher(matcher, cluster.members, kind, "optional");
    reasons.push(result.reason);
    if (result.count > 0) {
      optionalHits += 1;
    }
  }
  const completenessBonus =
    required.length > 0 && requiredHits === required.length ? ALL_REQUIRED_BONUS : 0;
  const score =
    requiredHits * REQUIRED_SCORE_WEIGHT + optionalHits * OPTIONAL_SCORE_WEIGHT + completenessBonus;
  return { score, reasons };
}

function evaluateMatcher(
  matcher: RoleArityMatcher,
  members: ReadonlyArray<ClassifiedField>,
  archetypeKind: FormKind,
  role: "required" | "optional" | "forbidden",
): { satisfied: boolean; count: number; reason: ClassificationReason } {
  const allowedKinds = new Set<FieldRole>(matcher.kinds);
  const matchedFieldOpids: string[] = [];
  for (const cf of members) {
    const { kind, confidence } = argmax(cf.distribution);
    if (kind === "unknown" || !allowedKinds.has(kind)) {
      continue;
    }
    if (matcher.requireViewable && !cf.cluster.members.some((m) => m.signals.tight.viewable)) {
      continue;
    }
    if (!bandMeets(bandFor(confidence), matcher.minBand)) {
      continue;
    }
    matchedFieldOpids.push(cf.cluster.id);
  }
  const count = matchedFieldOpids.length;
  let satisfied: boolean;
  let outcome: MatcherOutcome;
  if (count < matcher.min) {
    satisfied = false;
    outcome = "failed-min";
  } else if (matcher.max !== undefined && count > matcher.max) {
    satisfied = false;
    outcome = role === "forbidden" ? "vetoed" : "failed-max";
  } else {
    satisfied = true;
    outcome = "satisfied";
  }
  return {
    satisfied,
    count,
    reason: {
      type: "archetype-matcher",
      contributedTo: archetypeKind,
      outcome,
      matcherKinds: matcher.kinds,
      matchedFieldOpids,
      min: matcher.min,
      max: matcher.max,
      role,
    },
  };
}

function bandMeets(actual: ConfidenceBand, minimum: ConfidenceBand): boolean {
  const rank: Record<ConfidenceBand, number> = {
    disqualified: -1,
    none: 0,
    low: 1,
    high: 2,
    certain: 3,
  };
  return rank[actual] >= rank[minimum];
}

function ambientPriorFor(
  ambient: AmbientSignals,
  tokens: ReadonlyArray<string>,
  archetypeKind: FormKind,
): AmbientPriorResult {
  const reasons: ClassificationReason[] = [];
  const slots: ReadonlyArray<{
    name: AmbientSlotName;
    sources: ReadonlyArray<{ raw: string; tokens: ReadonlySet<string> } | null>;
  }> = [
    { name: "formAttrs", sources: ambient.formAttrs },
    { name: "submitButtonText", sources: ambient.submitButtonText },
    { name: "headings", sources: ambient.headings },
    { name: "pageTitle", sources: [ambient.pageTitle] },
    { name: "urlPath", sources: [ambient.urlPath] },
  ];
  let matchedSlots = 0;
  for (const slot of slots) {
    let slotMatched = false;
    for (const source of slot.sources) {
      if (source === null) {
        continue;
      }
      for (const token of tokens) {
        if (source.tokens.has(token)) {
          slotMatched = true;
          reasons.push({
            type: "ambient-cue",
            contributedTo: archetypeKind,
            slot: slot.name,
            raw: source.raw,
            matchedToken: token,
          });
        }
      }
    }
    if (slotMatched) {
      matchedSlots += 1;
    }
  }
  return { boost: matchedSlots * PER_SLOT_AMBIENT_BOOST, reasons };
}

export const ACCOUNT_LOGIN_ARCHETYPE: FormArchetype = {
  kind: "account-login",
  required: accountLoginRequired,
  optional: accountLoginOptional,
  forbidden: accountLoginForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "account-login",
      accountLoginRequired,
      accountLoginOptional,
      accountLoginForbidden,
    ),
  ambientPrior: (ambient) => ambientPriorFor(ambient, LOGIN_AMBIENT_TOKENS, "account-login"),
};

export const ACCOUNT_CREATION_ARCHETYPE: FormArchetype = {
  kind: "account-creation",
  required: accountCreationRequired,
  optional: accountCreationOptional,
  forbidden: accountCreationForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "account-creation",
      accountCreationRequired,
      accountCreationOptional,
      accountCreationForbidden,
    ),
  ambientPrior: (ambient) => ambientPriorFor(ambient, CREATION_AMBIENT_TOKENS, "account-creation"),
};

export const ACCOUNT_UPDATE_ARCHETYPE: FormArchetype = {
  kind: "account-update",
  required: accountUpdateRequired,
  optional: accountUpdateOptional,
  forbidden: accountUpdateForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "account-update",
      accountUpdateRequired,
      accountUpdateOptional,
      accountUpdateForbidden,
    ),
  ambientPrior: (ambient) => ambientPriorFor(ambient, UPDATE_AMBIENT_TOKENS, "account-update"),
};

export const ACCOUNT_RECOVERY_ARCHETYPE: FormArchetype = {
  kind: "account-recovery",
  required: accountRecoveryRequired,
  optional: accountRecoveryOptional,
  forbidden: accountRecoveryForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "account-recovery",
      accountRecoveryRequired,
      accountRecoveryOptional,
      accountRecoveryForbidden,
    ),
  ambientPrior: (ambient) => ambientPriorFor(ambient, RECOVERY_AMBIENT_TOKENS, "account-recovery"),
};

export const PAYMENT_CARD_ARCHETYPE: FormArchetype = {
  kind: "payment-card",
  required: paymentCardRequired,
  optional: paymentCardOptional,
  forbidden: paymentCardForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "payment-card",
      paymentCardRequired,
      paymentCardOptional,
      paymentCardForbidden,
    ),
  ambientPrior: (ambient) => ambientPriorFor(ambient, PAYMENT_CARD_AMBIENT_TOKENS, "payment-card"),
};

export const IDENTITY_ARCHETYPE: FormArchetype = {
  kind: "identity",
  required: identityRequired,
  optional: identityOptional,
  forbidden: identityForbidden,
  score: (cluster) =>
    scoreArchetype(cluster, "identity", identityRequired, identityOptional, identityForbidden),
  ambientPrior: (ambient) => ambientPriorFor(ambient, IDENTITY_AMBIENT_TOKENS, "identity"),
};

export const SIGNUP_ARCHETYPE: FormArchetype = {
  kind: "signup",
  required: signupRequired,
  optional: signupOptional,
  forbidden: signupForbidden,
  score: (cluster) =>
    scoreArchetype(cluster, "signup", signupRequired, signupOptional, signupForbidden),
  ambientPrior: (ambient) => ambientPriorFor(ambient, SIGNUP_AMBIENT_TOKENS, "signup"),
};

export const ACCOUNT_USERNAME_RECOVERY_ARCHETYPE: FormArchetype = {
  kind: "account-username-recovery",
  required: usernameRecoveryRequired,
  optional: usernameRecoveryOptional,
  forbidden: usernameRecoveryForbidden,
  score: (cluster) =>
    scoreArchetype(
      cluster,
      "account-username-recovery",
      usernameRecoveryRequired,
      usernameRecoveryOptional,
      usernameRecoveryForbidden,
    ),
  ambientPrior: (ambient) =>
    ambientPriorFor(ambient, USERNAME_RECOVERY_AMBIENT_TOKENS, "account-username-recovery"),
};

export const ARCHETYPES: ReadonlyArray<FormArchetype> = [
  ACCOUNT_LOGIN_ARCHETYPE,
  ACCOUNT_CREATION_ARCHETYPE,
  ACCOUNT_UPDATE_ARCHETYPE,
  ACCOUNT_RECOVERY_ARCHETYPE,
  ACCOUNT_USERNAME_RECOVERY_ARCHETYPE,
  PAYMENT_CARD_ARCHETYPE,
  IDENTITY_ARCHETYPE,
  SIGNUP_ARCHETYPE,
];
