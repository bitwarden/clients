import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { PageQualification, QualificationEngine } from "../abstractions/qualification-engine";
import { parseAutocompleteTokens } from "../signals";
import {
  FieldClassification,
  FieldRole,
  FormCategory,
  FormClassification,
  PageScenario,
  QualificationEngineId,
} from "../types";

/**
 * Maps WHATWG `autocomplete` tokens to the roles they declare.
 *
 * Deliberately kept as a flat, readable table rather than derived from
 * `CUES_BY_KIND`. Legibility is this engine's whole value — you can read this
 * and know exactly what it will do. `autocomplete.engine.spec.ts` guards the
 * table against drifting from the scoring engine's `signal: "autocomplete"`
 * cues, so the duplication can't quietly rot.
 *
 * Two roles are intentionally absent. `updateCurrentPassword` has no token of
 * its own — it's a contextual distinction the attribute can't express — so it
 * falls through to the legacy service, which is what makes the adapter's
 * coverage negotiation observable. `identityEmail` and `identityUsername` are
 * absent for the reason given in `likelihood-ratios.ts`: a bare
 * `autocomplete="email"` means the credential email, not the profile one.
 */
const ROLE_BY_TOKEN: Readonly<Record<string, FieldRole>> = Object.freeze({
  username: FieldRole.Username,
  email: FieldRole.Email,
  "current-password": FieldRole.CurrentPassword,
  "new-password": FieldRole.NewPassword,
  "one-time-code": FieldRole.Totp,

  "cc-name": FieldRole.CardholderName,
  ccname: FieldRole.CardholderName,
  "cc-number": FieldRole.CardNumber,
  ccnumber: FieldRole.CardNumber,
  "cc-exp": FieldRole.CardExpirationDate,
  ccexp: FieldRole.CardExpirationDate,
  "cc-exp-month": FieldRole.CardExpirationMonth,
  ccexpmonth: FieldRole.CardExpirationMonth,
  "cc-exp-year": FieldRole.CardExpirationYear,
  ccexpyear: FieldRole.CardExpirationYear,
  "cc-csc": FieldRole.CardCvv,
  cccsc: FieldRole.CardCvv,
  "cc-type": FieldRole.CardBrand,
  cctype: FieldRole.CardBrand,

  "honorific-prefix": FieldRole.IdentityTitle,
  "given-name": FieldRole.IdentityFirstName,
  "additional-name": FieldRole.IdentityMiddleName,
  "family-name": FieldRole.IdentityLastName,
  name: FieldRole.IdentityFullName,
  "street-address": FieldRole.IdentityAddress1,
  "address-line1": FieldRole.IdentityAddress1,
  "address-line2": FieldRole.IdentityAddress2,
  "address-line3": FieldRole.IdentityAddress3,
  "address-level2": FieldRole.IdentityCity,
  "address-level1": FieldRole.IdentityState,
  "postal-code": FieldRole.IdentityPostalCode,
  country: FieldRole.IdentityCountry,
  "country-name": FieldRole.IdentityCountry,
  organization: FieldRole.IdentityCompany,
  tel: FieldRole.IdentityPhone,
});

const COVERED_ROLES: ReadonlySet<FieldRole> = Object.freeze(
  new Set(Object.values(ROLE_BY_TOKEN)),
) as ReadonlySet<FieldRole>;

const COVERED_CATEGORIES: ReadonlySet<FormCategory> = Object.freeze(
  new Set<FormCategory>([
    FormCategory.Login,
    FormCategory.AccountCreation,
    FormCategory.CreditCard,
    FormCategory.Identity,
  ]),
) as ReadonlySet<FormCategory>;

const CARD_ROLES: ReadonlySet<FieldRole> = new Set([
  FieldRole.CardholderName,
  FieldRole.CardNumber,
  FieldRole.CardExpirationDate,
  FieldRole.CardExpirationMonth,
  FieldRole.CardExpirationYear,
  FieldRole.CardCvv,
  FieldRole.CardBrand,
]);

const IDENTITY_ROLES: ReadonlySet<FieldRole> = new Set([
  FieldRole.IdentityTitle,
  FieldRole.IdentityFirstName,
  FieldRole.IdentityMiddleName,
  FieldRole.IdentityLastName,
  FieldRole.IdentityFullName,
  FieldRole.IdentityAddress1,
  FieldRole.IdentityAddress2,
  FieldRole.IdentityAddress3,
  FieldRole.IdentityCity,
  FieldRole.IdentityState,
  FieldRole.IdentityPostalCode,
  FieldRole.IdentityCountry,
  FieldRole.IdentityCompany,
  FieldRole.IdentityPhone,
]);

const SCENARIO_BY_CATEGORY: Readonly<Record<FormCategory, PageScenario>> = Object.freeze({
  [FormCategory.AccountCreation]: PageScenario.RegistrationPage,
  [FormCategory.CreditCard]: PageScenario.CheckoutPage,
  [FormCategory.Login]: PageScenario.LoginPage,
  [FormCategory.Identity]: PageScenario.ProfilePage,
});

// Ordered most to least specific. A signup form carries both a username and a
// new-password token, so checking AccountCreation before Login keeps it from
// reading as a plain login. Ties in `dominantCategory` resolve by this order.
const CATEGORY_PRECEDENCE: ReadonlyArray<FormCategory> = [
  FormCategory.CreditCard,
  FormCategory.AccountCreation,
  FormCategory.Login,
  FormCategory.Identity,
];

const NO_ROLES: ReadonlySet<FieldRole> = Object.freeze(new Set<FieldRole>());
const NO_CATEGORIES: ReadonlySet<FormCategory> = Object.freeze(new Set<FormCategory>());
const NO_SCORES = Object.freeze([]);

/**
 * Classifies fields purely from the WHATWG `autocomplete` attribute.
 *
 * No cue weights, no softmax, no clustering, no archetypes — an explicit
 * author declaration is either present or it isn't. That makes this engine a
 * genuinely different internal shape from {@link ScoringQualificationEngine}
 * while still being a real classifier rather than a stub, which is the point:
 * it proves the engine bay dispatches to implementations that share nothing
 * but the port.
 *
 * Confidence is binary. A mapped token yields `"certain"`; anything else
 * yields `"none"`. There is no middle band to model, because the engine reads
 * exactly one signal and that signal is an explicit declaration of intent.
 *
 * Coverage is narrow on purpose — see {@link ROLE_BY_TOKEN}. Roles it doesn't
 * map fall through to the legacy service via the adapter, so the demo shows
 * coverage negotiation working rather than just a swap.
 */
export class AutocompleteQualificationEngine implements QualificationEngine {
  readonly id = QualificationEngineId.Autocomplete;
  readonly name = "Autocomplete Attribute Engine";
  readonly version = "0.1.0";

  readonly coveredRoles = COVERED_ROLES;
  readonly coveredCategories = COVERED_CATEGORIES;

  classify(pageDetails: AutofillPageDetails): PageQualification {
    const rolesByField = new Map<string, FieldRole | null>();
    for (const field of pageDetails.fields) {
      rolesByField.set(field.opid, this.roleOf(field));
    }

    // Group by owning form so a page carrying a login form and a separate
    // checkout form doesn't blend into one category set. Fields outside any
    // form share a single implicit group, keyed by "".
    const rolesByForm = new Map<string, Set<FieldRole>>();
    for (const field of pageDetails.fields) {
      const role = rolesByField.get(field.opid);
      const key = field.form ?? "";
      const group = rolesByForm.get(key) ?? new Set<FieldRole>();
      if (role !== null && role !== undefined) {
        group.add(role);
      }
      rolesByForm.set(key, group);
    }

    const categoriesByForm = new Map<string, ReadonlySet<FormCategory>>();
    for (const [key, roles] of rolesByForm) {
      categoriesByForm.set(key, categoriesFor(roles));
    }

    const fieldClassifications = new Map<string, FieldClassification>();
    for (const field of pageDetails.fields) {
      const role = rolesByField.get(field.opid) ?? null;
      const formCategories = categoriesByForm.get(field.form ?? "") ?? NO_CATEGORIES;
      fieldClassifications.set(field.opid, buildFieldClassification(role, formCategories));
    }

    const formClassifications = new Map<string, FormClassification>();
    for (const form of Object.values(pageDetails.forms)) {
      const categories = categoriesByForm.get(form.opid) ?? NO_CATEGORIES;
      formClassifications.set(form.opid, buildFormClassification(categories));
    }

    const pageCategories = new Set<FormCategory>();
    for (const categories of categoriesByForm.values()) {
      for (const category of categories) {
        pageCategories.add(category);
      }
    }
    const dominant = dominantCategory(pageCategories);

    return {
      fieldFor: (opid) => fieldClassifications.get(opid) ?? null,
      formFor: (opid) => formClassifications.get(opid) ?? null,
      scenario: () => (dominant === null ? null : SCENARIO_BY_CATEGORY[dominant]),
    };
  }

  private roleOf(field: AutofillField): FieldRole | null {
    for (const token of parseAutocompleteTokens(field.autoCompleteType)) {
      const role = ROLE_BY_TOKEN[token];
      if (role !== undefined) {
        return role;
      }
    }
    return null;
  }
}

function categoriesFor(roles: ReadonlySet<FieldRole>): ReadonlySet<FormCategory> {
  const categories = new Set<FormCategory>();

  if (roles.has(FieldRole.NewPassword)) {
    categories.add(FormCategory.AccountCreation);
  }
  if (
    roles.has(FieldRole.CurrentPassword) &&
    (roles.has(FieldRole.Username) || roles.has(FieldRole.Email))
  ) {
    categories.add(FormCategory.Login);
  }
  for (const role of roles) {
    if (CARD_ROLES.has(role)) {
      categories.add(FormCategory.CreditCard);
    }
    if (IDENTITY_ROLES.has(role)) {
      categories.add(FormCategory.Identity);
    }
  }

  return categories;
}

/**
 * The category a field's own role places it in, used to intersect against its
 * form's categories. A field belongs to a form context only when both agree —
 * a card number in a checkout form is a CreditCard field, but a stray country
 * dropdown in a login form is not a Login field.
 */
function categoryOfRole(role: FieldRole): FormCategory | null {
  if (role === FieldRole.NewPassword) {
    return FormCategory.AccountCreation;
  }
  if (role === FieldRole.CurrentPassword || role === FieldRole.Username) {
    return FormCategory.Login;
  }
  if (CARD_ROLES.has(role)) {
    return FormCategory.CreditCard;
  }
  if (IDENTITY_ROLES.has(role)) {
    return FormCategory.Identity;
  }
  // Email is deliberately unmapped: it serves both Login and Identity, and
  // guessing between them from one token would be exactly the kind of
  // inference this engine exists to avoid.
  return null;
}

function buildFieldClassification(
  role: FieldRole | null,
  formCategories: ReadonlySet<FormCategory>,
): FieldClassification {
  if (role === null) {
    return {
      matchedRoles: NO_ROLES,
      matchedFormContexts: NO_CATEGORIES,
      topRole: null,
      confidence: "none",
      score: 0,
      allScores: NO_SCORES,
    };
  }

  const ownCategory = categoryOfRole(role);
  const matchedFormContexts =
    ownCategory !== null && formCategories.has(ownCategory)
      ? new Set([ownCategory])
      : NO_CATEGORIES;

  return {
    matchedRoles: new Set([role]),
    matchedFormContexts,
    topRole: role,
    confidence: "certain",
    score: 1,
    allScores: [{ role, score: 1 }],
  };
}

function buildFormClassification(categories: ReadonlySet<FormCategory>): FormClassification {
  const topCategory = dominantCategory(categories);

  return {
    matchedCategories: categories,
    topCategory,
    confidence: categories.size > 0 ? "certain" : "none",
    score: categories.size > 0 ? 1 : 0,
    allScores: [...categories].map((category) => ({ category, score: 1 })),
  };
}

function dominantCategory(categories: ReadonlySet<FormCategory>): FormCategory | null {
  return CATEGORY_PRECEDENCE.find((category) => categories.has(category)) ?? null;
}
