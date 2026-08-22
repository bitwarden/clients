import { AutofillTargetingRuleTypes } from "@bitwarden/common/autofill/constants";
import { AutofillTargetingRuleType, FormPurposeCategory } from "@bitwarden/common/autofill/types";

import { AutofillFieldQualifier } from "../enums/autofill-field.enums";

import {
  FIELD_QUALIFIER_BY_ROLE,
  FORM_KIND_BY_PURPOSE_CATEGORY,
  ROLE_BY_TARGETING_RULE_TYPE,
} from "./role-mapping";
import { FormKind } from "./types";
import { FieldRole } from "./types/field-role";

describe("FIELD_QUALIFIER_BY_ROLE", () => {
  it("covers every FieldRole", () => {
    expect(Object.keys(FIELD_QUALIFIER_BY_ROLE).sort()).toEqual(Object.values(FieldRole).sort());
  });

  it("only produces real AutofillFieldQualifier values", () => {
    const valid = new Set<string>(Object.values(AutofillFieldQualifier));
    const produced = Object.values(FIELD_QUALIFIER_BY_ROLE).filter((q) => q !== null);

    expect(produced.every((q) => valid.has(q as string))).toBe(true);
  });

  it("reaches every qualifier the overlay's maps could assign", () => {
    // `qualifyUserFilledField` assigns from these four maps today. A role table
    // that can't produce one of their qualifiers would silently stop tagging
    // that field once the assignment moves to the engine.
    const reachable = new Set(Object.values(FIELD_QUALIFIER_BY_ROLE));

    for (const qualifier of Object.values(AutofillFieldQualifier)) {
      expect(reachable.has(qualifier)).toBe(true);
    }
  });

  it("sends both current-password roles to the same qualifier", () => {
    // A captured value carries no flow, so the update-vs-login distinction has
    // nowhere to go.
    expect(FIELD_QUALIFIER_BY_ROLE[FieldRole.UpdateCurrentPassword]).toBe(
      FIELD_QUALIFIER_BY_ROLE[FieldRole.CurrentPassword],
    );
  });

  it.each([FieldRole.Email, FieldRole.Totp, FieldRole.CardBrand])(
    "has no qualifier for %s",
    (role) => {
      expect(FIELD_QUALIFIER_BY_ROLE[role]).toBeNull();
    },
  );
});

describe("ROLE_BY_TARGETING_RULE_TYPE", () => {
  it("covers every targeting rule type", () => {
    expect(Object.keys(ROLE_BY_TARGETING_RULE_TYPE).sort()).toEqual(
      Object.values(AutofillTargetingRuleTypes).sort(),
    );
  });

  it("only produces real FieldRole values", () => {
    const valid = new Set<string>(Object.values(FieldRole));
    const produced = Object.values(ROLE_BY_TARGETING_RULE_TYPE).filter((r) => r !== null);

    expect(produced.every((r) => valid.has(r as string))).toBe(true);
  });

  it("reads bare email and username as the credential, not the profile field", () => {
    expect(ROLE_BY_TARGETING_RULE_TYPE[AutofillTargetingRuleTypes.email]).toBe(FieldRole.Email);
    expect(ROLE_BY_TARGETING_RULE_TYPE[AutofillTargetingRuleTypes.username]).toBe(
      FieldRole.Username,
    );
  });

  it("maps both street-address spellings to the first address line", () => {
    expect(ROLE_BY_TARGETING_RULE_TYPE[AutofillTargetingRuleTypes.streetAddress]).toBe(
      FieldRole.IdentityAddress1,
    );
    expect(ROLE_BY_TARGETING_RULE_TYPE[AutofillTargetingRuleTypes.addressLine1]).toBe(
      FieldRole.IdentityAddress1,
    );
  });

  it.each([
    AutofillTargetingRuleTypes.phoneAreaCode,
    AutofillTargetingRuleTypes.birthdateYear,
    AutofillTargetingRuleTypes.addressLevel3,
    AutofillTargetingRuleTypes.consentTerms,
    AutofillTargetingRuleTypes.searchTerm,
  ] as AutofillTargetingRuleType[])("has no role for %s", (ruleType) => {
    expect(ROLE_BY_TARGETING_RULE_TYPE[ruleType]).toBeNull();
  });
});

describe("FORM_KIND_BY_PURPOSE_CATEGORY", () => {
  it("covers every form purpose category", () => {
    expect(Object.keys(FORM_KIND_BY_PURPOSE_CATEGORY).sort()).toEqual(
      (
        [
          "account-creation",
          "account-login",
          "account-recovery",
          "account-update",
          "address",
          "identity",
          "payment-card",
          "search",
          "signup",
        ] as FormPurposeCategory[]
      ).sort(),
    );
  });

  it("maps each shared spelling to the identically-named FormKind", () => {
    // The two vocabularies were spelled the same before either knew about the
    // other. This is what keeps that from being a coincidence.
    for (const [category, kind] of Object.entries(FORM_KIND_BY_PURPOSE_CATEGORY)) {
      if (kind !== null) {
        expect(kind).toBe(category);
      }
    }
  });

  it("has no FormKind for address-only or search forms", () => {
    expect(FORM_KIND_BY_PURPOSE_CATEGORY.address).toBeNull();
    expect(FORM_KIND_BY_PURPOSE_CATEGORY.search).toBeNull();
  });

  it("reaches every FormKind the engine can emit except the recovery split", () => {
    // `account-username-recovery` is an engine-internal refinement of recovery;
    // the rule vocabulary has one recovery category and no way to express it.
    const reachable = new Set(Object.values(FORM_KIND_BY_PURPOSE_CATEGORY));
    const unreachable = Object.values(FormKind).filter((kind) => !reachable.has(kind));

    expect(unreachable).toEqual([FormKind.AccountUsernameRecovery]);
  });
});
