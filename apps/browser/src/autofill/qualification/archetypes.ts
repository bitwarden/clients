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
const REQUIRED_SCORE_WEIGHT = 0.5;
const OPTIONAL_SCORE_WEIGHT = 0.1;

type ArchetypeConfig = {
  readonly kind: FormKind;
  readonly required: ReadonlyArray<RoleArityMatcher>;
  readonly optional: ReadonlyArray<RoleArityMatcher>;
  readonly forbidden: ReadonlyArray<RoleArityMatcher>;
  readonly ambientTokens: ReadonlyArray<string>;
};

function defineArchetype(config: ArchetypeConfig): FormArchetype {
  return {
    kind: config.kind,
    required: config.required,
    optional: config.optional,
    forbidden: config.forbidden,
    score: (cluster) =>
      scoreArchetype(cluster, config.kind, config.required, config.optional, config.forbidden),
    ambientPrior: (ambient) => ambientPriorFor(ambient, config.ambientTokens, config.kind),
  };
}

export const ACCOUNT_LOGIN_ARCHETYPE = defineArchetype({
  kind: "account-login",
  required: [
    { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 1, max: 1 },
    { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 1, max: 1 },
  ],
  optional: [{ kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 }],
  forbidden: [{ kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 }],
  ambientTokens: ["signin", "login", "loginform"],
});

export const ACCOUNT_CREATION_ARCHETYPE = defineArchetype({
  kind: "account-creation",
  required: [
    { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 },
    { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 1, max: 2 },
  ],
  optional: [{ kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 }],
  forbidden: [
    { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 },
  ],
  ambientTokens: [
    "signup",
    "register",
    "createaccount",
    "createyouraccount",
    "newaccount",
    "joinnow",
    "getstarted",
  ],
});

export const ACCOUNT_UPDATE_ARCHETYPE = defineArchetype({
  kind: "account-update",
  required: [
    { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 1, max: 1 },
    { kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 },
  ],
  optional: [
    { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  ],
  forbidden: [],
  ambientTokens: [
    "changepassword",
    "updatepassword",
    "setnewpassword",
    "changeyourpassword",
    "passwordsettings",
  ],
});

export const ACCOUNT_RECOVERY_ARCHETYPE = defineArchetype({
  kind: "account-recovery",
  required: [{ kinds: ["newPassword"], minBand: "high", requireViewable: true, min: 1, max: 2 }],
  optional: [
    { kinds: ["username", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["totp"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  ],
  forbidden: [
    { kinds: ["currentPassword"], minBand: "high", requireViewable: true, min: 0, max: 0 },
  ],
  ambientTokens: [
    "forgotpassword",
    "forgotyourpassword",
    "resetpassword",
    "resetyourpassword",
    "passwordreset",
    "passwordrecovery",
    "recoverpassword",
    "recoveraccount",
  ],
});

// `payment-card` and `identity` overlap on checkout-style ambient tokens
// (billing*, checkout) by design. A checkout flow is genuinely both a
// payment-card archetype (card number, expiry, CVV) and an identity archetype
// (shipping name + address); the engine should match both via
// `matchedCategories` rather than force the page to pick a winner.
export const PAYMENT_CARD_ARCHETYPE = defineArchetype({
  kind: "payment-card",
  required: [
    { kinds: ["cardNumber"], minBand: "high", requireViewable: true, min: 1, max: 1 },
    {
      kinds: ["cardExpirationDate", "cardExpirationMonth", "cardExpirationYear"],
      minBand: "high",
      requireViewable: true,
      min: 1,
      max: 3,
    },
  ],
  optional: [
    { kinds: ["cardholderName"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["cardCvv"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  ],
  // Intentionally empty: positive card evidence (cardNumber autocomplete, etc.)
  // is decisive enough that we don't need to veto on the presence of password
  // fields. A combined "create account + checkout" form genuinely is both
  // AccountCreation *and* PaymentCard.
  forbidden: [],
  ambientTokens: [
    "checkout",
    "creditcard",
    "billingdetails",
    "billinginformation",
    "paymentdetails",
    "paymentinformation",
    "paymentmethod",
  ],
});

// `identity`: a profile / address / contact form. Requires at least one
// name-shape field and one address-shape field. No forbidden — identity forms
// coexist with checkout (shipping address + payment card on one page).
export const IDENTITY_ARCHETYPE = defineArchetype({
  kind: "identity",
  required: [
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
  ],
  optional: [
    { kinds: ["identityTitle"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityMiddleName"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityAddress2"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityAddress3"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityCompany"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityPhone"], minBand: "high", requireViewable: true, min: 0, max: 1 },
    { kinds: ["identityEmail", "email"], minBand: "high", requireViewable: true, min: 0, max: 1 },
  ],
  forbidden: [],
  ambientTokens: [
    "profile",
    "shippingaddress",
    "billingaddress",
    "contactinformation",
    "contactdetails",
    "personalinformation",
    "personaldetails",
    "yourdetails",
    "shippinginformation",
  ],
});

// `signup` (newsletter / mailing-list): lightweight form with email and maybe
// name(s). NOT account-creation — distinguished by the absence of password
// fields.
export const SIGNUP_ARCHETYPE = defineArchetype({
  kind: "signup",
  required: [{ kinds: ["email"], minBand: "high", requireViewable: true, min: 1, max: 1 }],
  optional: [
    {
      kinds: ["identityFirstName", "identityLastName", "identityFullName"],
      minBand: "high",
      requireViewable: true,
      min: 0,
      max: 3,
    },
  ],
  forbidden: [
    {
      kinds: ["currentPassword", "newPassword"],
      minBand: "high",
      requireViewable: true,
      min: 0,
      max: 0,
    },
  ],
  ambientTokens: [
    "subscribe",
    "newsletter",
    "joinourlist",
    "joinmailing",
    "stayintouch",
    "stayinformed",
    "getourupdates",
    "joinnow",
  ],
});

// `account-username-recovery`: a "forgot username" form — just email, no
// password. Distinguishes from `signup` primarily by ambient signals.
export const ACCOUNT_USERNAME_RECOVERY_ARCHETYPE = defineArchetype({
  kind: "account-username-recovery",
  required: [{ kinds: ["email"], minBand: "high", requireViewable: true, min: 1, max: 1 }],
  optional: [],
  forbidden: [
    {
      kinds: ["currentPassword", "newPassword"],
      minBand: "high",
      requireViewable: true,
      min: 0,
      max: 0,
    },
  ],
  ambientTokens: [
    "forgotusername",
    "forgotyourusername",
    "recoverusername",
    "findyouraccount",
    "findaccount",
    "lookupaccount",
  ],
});

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
