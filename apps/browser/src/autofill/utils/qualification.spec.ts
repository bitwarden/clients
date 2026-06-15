import {
  createAutofillFieldMock,
  createAutofillFormMock,
  createAutofillPageDetailsMock,
} from "../spec/autofill-mocks";

import {
  classifyHeadings,
  fieldContainsKeyword,
  formContainsKeyword,
  isNonLoginUsernameField,
  isAmbiguousFieldNonLogin,
  KeywordMatchMode,
} from "./qualification";

function neutralField(overrides = {}) {
  return createAutofillFieldMock({
    htmlID: "email",
    htmlName: "email",
    htmlClass: "",
    title: "",
    "label-left": "",
    "label-right": "",
    "label-top": "",
    "label-tag": "",
    "label-aria": "",
    placeholder: "",
    autoCompleteType: "",
    form: "form-1",
    ...overrides,
  });
}

function neutralForm(overrides = {}) {
  return createAutofillFormMock({
    opid: "form-1",
    htmlID: "form",
    htmlName: "form",
    htmlAction: "/submit",
    htmlClass: "",
    htmlAncestorHeadings: [],
    ...overrides,
  });
}

describe("fieldContainsKeyword", () => {
  it("returns false if the field has no matching attribute values", () => {
    const field = createAutofillFieldMock({ htmlID: "unrelated", htmlName: "unrelated" });

    expect(fieldContainsKeyword(field, ["password"])).toBe(false);
  });

  it("matches a keyword appearing within a token", () => {
    const field = createAutofillFieldMock({ htmlID: "my-password-field" });

    expect(fieldContainsKeyword(field, ["password"])).toBe(true);
  });

  it("matches via tokenization of a hyphenated field ID", () => {
    const field = createAutofillFieldMock({ htmlID: "credit-card-number" });

    expect(fieldContainsKeyword(field, ["creditcardnumber"])).toBe(true);
  });

  it("matchesToken mode: matches a keyword that is exactly a token", () => {
    const field = createAutofillFieldMock({ htmlName: "email" });

    expect(fieldContainsKeyword(field, ["email"], KeywordMatchMode.MatchesToken)).toBe(true);
  });

  it("matchesToken mode: does not match when keyword is only part of a token", () => {
    const field = createAutofillFieldMock({ htmlName: "emailaddress" });

    expect(fieldContainsKeyword(field, ["email"], KeywordMatchMode.MatchesToken)).toBe(false);
  });

  it("caching: second call on same field uses cached data without re-computing", () => {
    const field = createAutofillFieldMock({ htmlID: "username" });

    const result1 = fieldContainsKeyword(field, ["username"]);
    const result2 = fieldContainsKeyword(field, ["username"]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });

  it("hyphenated keyword: strips hyphens before matching so 'new-password' matches htmlName 'newpassword'", () => {
    const field = createAutofillFieldMock({ htmlName: "newpassword" });

    expect(fieldContainsKeyword(field, ["new-password"])).toBe(true);
  });

  it("multi-word keyword: does not match when the words appear non-contiguously in the field value", () => {
    const field = createAutofillFieldMock({ placeholder: "Create your password" });

    expect(fieldContainsKeyword(field, ["create password"])).toBe(false);
  });

  it("label attributes: matches a keyword found in label-tag when not present in htmlID or htmlName", () => {
    const field = createAutofillFieldMock({
      htmlID: "oid",
      htmlName: "oid",
      "label-tag": "User ID",
    });

    // "User ID" tokenizes to include "userid", which is in UsernameFieldNames.
    // This is the label-awareness introduced by this PR.
    expect(fieldContainsKeyword(field, ["userid"])).toBe(true);
  });

  it("null/falsy attributes: returns false without throwing when all checked attributes are empty", () => {
    const field = createAutofillFieldMock({
      htmlID: "",
      htmlName: "",
      htmlClass: "",
      type: "",
      title: "",
      placeholder: "",
      autoCompleteType: "",
      dataSetValues: "",
      "label-data": "",
      "label-aria": "",
      "label-left": "",
      "label-right": "",
      "label-tag": "",
      "label-top": "",
    });

    expect(fieldContainsKeyword(field, ["username"])).toBe(false);
  });
});

describe("formContainsKeyword", () => {
  it("returns false when no form attribute matches", () => {
    const form = createAutofillFormMock({
      htmlID: "login",
      htmlName: "login",
      htmlAction: "/auth/login",
      htmlClass: "",
      htmlAncestorHeadings: [],
    });

    expect(formContainsKeyword(form, ["newsletter"])).toBe(false);
  });

  it("matches a keyword appearing in htmlID", () => {
    const form = createAutofillFormMock({ htmlID: "newsletter-signup" });

    expect(formContainsKeyword(form, ["newsletter"])).toBe(true);
  });

  it("matches against htmlName (case-insensitive)", () => {
    const form = createAutofillFormMock({ htmlName: "Newsletter" });

    expect(formContainsKeyword(form, ["newsletter"])).toBe(true);
  });

  it("matches against htmlAction", () => {
    const form = createAutofillFormMock({ htmlAction: "/subscribe/newsletter" });

    expect(formContainsKeyword(form, ["newsletter"])).toBe(true);
  });

  it("matches against htmlClass", () => {
    const form = createAutofillFormMock({ htmlClass: "subscribe-form" });

    expect(formContainsKeyword(form, ["subscribe"])).toBe(true);
  });

  it("does not consider htmlAncestorHeadings (heading classification lives in classifyHeadings)", () => {
    const form = createAutofillFormMock({
      htmlID: "",
      htmlName: "",
      htmlAction: "",
      htmlClass: "",
      htmlAncestorHeadings: ["join our mailing list today"],
    });

    expect(formContainsKeyword(form, ["mailing list"])).toBe(false);
  });

  it("matchesToken mode: matches a keyword that is exactly a token", () => {
    const form = createAutofillFormMock({ htmlName: "newsletter" });

    expect(formContainsKeyword(form, ["newsletter"], KeywordMatchMode.MatchesToken)).toBe(true);
  });

  it("matchesToken mode: does not match when keyword is only part of a token", () => {
    const form = createAutofillFormMock({ htmlName: "newslettersubscribe" });

    expect(formContainsKeyword(form, ["newsletter"], KeywordMatchMode.MatchesToken)).toBe(false);
  });

  it("hyphenated keyword: strips hyphens before matching so 'mailing-list' matches htmlClass 'mailinglist'", () => {
    const form = createAutofillFormMock({ htmlClass: "mailinglist" });

    expect(formContainsKeyword(form, ["mailing-list"])).toBe(true);
  });

  it("caching: second call on same form returns the same result", () => {
    const form = createAutofillFormMock({ htmlID: "newsletter-form" });

    const result1 = formContainsKeyword(form, ["newsletter"]);
    const result2 = formContainsKeyword(form, ["newsletter"]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });

  it("returns false without throwing when all form attributes are empty", () => {
    const form = createAutofillFormMock({
      htmlID: "",
      htmlName: "",
      htmlAction: "",
      htmlClass: "",
      htmlAncestorHeadings: [],
    });

    expect(formContainsKeyword(form, ["newsletter"])).toBe(false);
  });
});

describe("classifyHeadings", () => {
  const loginKeywords = ["sign in", "signin", "login"];
  const identityKeywords = ["newsletter", "subscribe", "mailing list"];

  it("returns 'ambiguous' when no headings are provided", () => {
    expect(classifyHeadings(undefined, loginKeywords, identityKeywords)).toBe("ambiguous");
    expect(classifyHeadings([], loginKeywords, identityKeywords)).toBe("ambiguous");
  });

  it("returns 'login' when the closest heading matches a login keyword", () => {
    expect(classifyHeadings(["Sign in"], loginKeywords, identityKeywords)).toBe("login");
  });

  it("returns 'identity' when the closest heading matches an identity keyword", () => {
    expect(classifyHeadings(["Subscribe to our newsletter"], loginKeywords, identityKeywords)).toBe(
      "identity",
    );
  });

  it("first-match-wins: a closer login signal short-circuits a later identity signal", () => {
    expect(
      classifyHeadings(["Sign in", "Subscribe to our newsletter"], loginKeywords, identityKeywords),
    ).toBe("login");
  });

  it("first-match-wins: a closer identity signal short-circuits a later login signal", () => {
    expect(classifyHeadings(["Newsletter", "Sign in"], loginKeywords, identityKeywords)).toBe(
      "identity",
    );
  });

  it("skips headings with no signal until a matching one is found", () => {
    expect(
      classifyHeadings(
        ["Email address", "Subscribe to our newsletter"],
        loginKeywords,
        identityKeywords,
      ),
    ).toBe("identity");
  });

  it("returns 'ambiguous' when no heading matches either list", () => {
    expect(
      classifyHeadings(["Email", "Continue", "Welcome"], loginKeywords, identityKeywords),
    ).toBe("ambiguous");
  });

  it("ignores non-string and empty entries", () => {
    expect(
      classifyHeadings([null as unknown as string, "", "Sign in"], loginKeywords, identityKeywords),
    ).toBe("login");
  });
});

describe("isNonLoginUsernameField", () => {
  it("returns true via the form-level path (htmlID contains 'newsletter')", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm({ htmlID: "newsletter-form" }) },
      fields: [field],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(true);
  });

  it("returns true via the field-level path (placeholder contains 'newsletter')", () => {
    const field = neutralField({ placeholder: "Newsletter email" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(true);
  });

  it("returns true via the field-level path when label-left carries the signal", () => {
    const field = neutralField({ "label-left": "Subscribe to our newsletter" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(true);
  });

  it("returns true via the sibling-field path", () => {
    const field = neutralField({ opid: "primary" });
    const sibling = neutralField({
      opid: "sibling",
      htmlName: "newsletter_optin",
      placeholder: "",
      "label-tag": "Sign me up",
    });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field, sibling],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(true);
  });

  it("ignores siblings in a different form", () => {
    const field = neutralField({ opid: "primary", form: "form-1" });
    const otherFormSibling = neutralField({
      opid: "other",
      form: "form-2",
      htmlName: "newsletter",
    });
    const pageDetails = createAutofillPageDetailsMock({
      forms: {
        "form-1": neutralForm(),
        "form-2": neutralForm({ opid: "form-2", htmlID: "other", htmlName: "other" }),
      },
      fields: [field, otherFormSibling],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(false);
  });

  it("returns false when no signal exists on the form, field, or any sibling (login regression case)", () => {
    const field = neutralField({ opid: "primary" });
    const sibling = neutralField({ opid: "sibling", htmlName: "password", type: "password" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field, sibling],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(false);
  });

  it("returns false for a formless field with no field-level signal (sibling check is skipped)", () => {
    const field = neutralField({ form: undefined });
    const otherField = neutralField({ opid: "other", form: undefined, htmlName: "newsletter" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: {},
      fields: [field, otherField],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(false);
  });

  it("falls through to field/sibling checks when the field's form id is missing from pageDetails.forms", () => {
    const field = neutralField({ form: "missing", placeholder: "Newsletter email" });
    const pageDetails = createAutofillPageDetailsMock({ forms: {}, fields: [field] });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(true);
  });
});

describe("isAmbiguousFieldNonLogin", () => {
  it("returns true when the form's htmlClass matches an ambiguous keyword", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm({ htmlClass: "newsletter-form-input" }) },
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns true when an htmlAncestorHeadings entry matches 'mailing list'", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: {
        "form-1": neutralForm({ htmlAncestorHeadings: ["join our mailing list today"] }),
      },
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns true when an htmlAncestorHeadings entry matches 'subscribe'", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm({ htmlAncestorHeadings: ["join our subscribers list"] }) },
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns true when an htmlAncestorHeadings entry matches 'subscription' (e.g. 'manage your subscriptions')", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm({ htmlAncestorHeadings: ["manage your subscriptions"] }) },
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns true when the field's own attributes carry an ambiguous keyword", () => {
    const field = neutralField({ placeholder: "Subscribe to weekly digest" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns true when a same-form sibling carries an ambiguous keyword in a label-* attribute", () => {
    const field = neutralField({ opid: "primary" });
    const sibling = neutralField({
      opid: "sibling",
      "label-tag": "Subscribe me to weekly updates",
    });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field, sibling],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns false when no signal is present on form, field, or siblings", () => {
    const field = neutralField({ opid: "primary" });
    const sibling = neutralField({ opid: "sibling", htmlName: "first_name" });
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm() },
      fields: [field, sibling],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(false);
  });

  it("matches keywords the StrictNonLoginKeywords list does not (e.g. 'subscribe' on the form class)", () => {
    const field = neutralField();
    const pageDetails = createAutofillPageDetailsMock({
      forms: { "form-1": neutralForm({ htmlClass: "subscribe-form" }) },
      fields: [field],
    });

    expect(isNonLoginUsernameField(field, pageDetails)).toBe(false);
    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(true);
  });

  it("returns false for a formless field with no signal anywhere", () => {
    const field = neutralField({ form: undefined });
    const pageDetails = createAutofillPageDetailsMock({
      forms: {},
      fields: [field],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(false);
  });

  it("ignores siblings in a different form", () => {
    const field = neutralField({ opid: "primary", form: "form-1" });
    const otherFormSibling = neutralField({
      opid: "other",
      form: "form-2",
      htmlName: "newsletter_email",
    });
    const pageDetails = createAutofillPageDetailsMock({
      forms: {
        "form-1": neutralForm(),
        "form-2": neutralForm({ opid: "form-2" }),
      },
      fields: [field, otherFormSibling],
    });

    expect(isAmbiguousFieldNonLogin(field, pageDetails)).toBe(false);
  });
});
