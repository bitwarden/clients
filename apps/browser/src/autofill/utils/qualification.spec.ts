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
});
