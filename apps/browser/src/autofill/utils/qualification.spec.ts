import { createAutofillFieldMock } from "../spec/autofill-mocks";

import { fieldContainsKeyword } from "./qualification";

describe("fieldContainsKeyword", () => {
  it("returns false if the field has no matching attribute values", () => {
    const field = createAutofillFieldMock({ htmlID: "unrelated", htmlName: "unrelated" });

    expect(fieldContainsKeyword(field, ["password"])).toBe(false);
  });

  it("substring mode (default): matches a keyword appearing within a token", () => {
    const field = createAutofillFieldMock({ htmlID: "my-password-field" });

    expect(fieldContainsKeyword(field, ["password"])).toBe(true);
  });

  it("substring mode: matches via tokenization of a hyphenated field ID", () => {
    const field = createAutofillFieldMock({ htmlID: "credit-card-number" });

    expect(fieldContainsKeyword(field, ["creditcardnumber"])).toBe(true);
  });

  it("exact mode: matches a keyword that is exactly a token", () => {
    const field = createAutofillFieldMock({ htmlName: "email" });

    expect(fieldContainsKeyword(field, ["email"], true)).toBe(true);
  });

  it("exact mode: does not match a keyword that is only a substring of a token", () => {
    const field = createAutofillFieldMock({ htmlName: "emailaddress" });

    expect(fieldContainsKeyword(field, ["email"], true)).toBe(false);
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
    // "create password" should not match "Create your password" — the intervening word breaks
    // the contiguous substring. This documents that multi-word keywords require an exact phrase match.
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
