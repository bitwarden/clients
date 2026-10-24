import { createAutofillFieldMock, createAutofillPageDetailsMock } from "../spec/autofill-mocks";

import { generateLoginFillScript, type LoginFillOptions } from "./login-fill-script";

describe("generateLoginFillScript", () => {
  const options: LoginFillOptions = {
    skipUsernameOnlyFill: false,
    onlyEmptyFields: false,
    fillNewPassword: false,
    allowTotpAutofill: false,
    autoSubmitLogin: false,
  };
  const credential = { username: "user", password: "pass" };

  const usernameField = createAutofillFieldMock({
    opid: "u",
    form: "form-1",
    elementNumber: 1,
    htmlID: "username",
    htmlName: "username",
    type: "text",
    value: "",
  });
  const passwordField = createAutofillFieldMock({
    opid: "p",
    form: "form-1",
    elementNumber: 2,
    htmlID: "pw",
    htmlName: "pw",
    type: "password",
    autoCompleteType: "current-password",
    value: "",
  });

  it("fills the username and password of a login form and focuses the password", () => {
    const pageDetails = createAutofillPageDetailsMock({
      fields: [usernameField, passwordField],
    });

    const script = generateLoginFillScript(pageDetails, credential, options);

    expect(script.script).toEqual([
      ["click_on_opid", "u"],
      ["focus_by_opid", "u"],
      ["fill_by_opid", "u", "user"],
      ["click_on_opid", "p"],
      ["focus_by_opid", "p"],
      ["fill_by_opid", "p", "pass"],
      ["focus_by_opid", "p"],
    ]);
    expect(script.savedUrls).toEqual([]);
    expect(script.untrustedIframe).toBe(false);
  });

  it("ignores search fields and produces an empty script when no login fields exist", () => {
    const search = createAutofillFieldMock({
      opid: "s",
      type: "search",
      htmlName: "q",
      value: "",
    });
    const pageDetails = createAutofillPageDetailsMock({ fields: [search] });

    expect(generateLoginFillScript(pageDetails, credential, options).script).toEqual([]);
  });

  it("fills a TOTP code into a one-time-code field next to the password", () => {
    const totpField = createAutofillFieldMock({
      opid: "t",
      form: "form-1",
      elementNumber: 3,
      htmlID: "otp",
      htmlName: "otp",
      type: "text",
      autoCompleteType: "one-time-code",
      value: "",
    });
    const pageDetails = createAutofillPageDetailsMock({
      fields: [usernameField, passwordField, totpField],
    });

    const script = generateLoginFillScript(
      pageDetails,
      { ...credential, totp: "123456" },
      { ...options, allowTotpAutofill: true },
    );

    expect(script.script).toContainEqual(["fill_by_opid", "t", "123456"]);
  });

  it("does not fill TOTP when it is not allowed", () => {
    const totpField = createAutofillFieldMock({
      opid: "t",
      form: "form-1",
      elementNumber: 3,
      htmlID: "otp",
      type: "text",
      autoCompleteType: "one-time-code",
      value: "",
    });
    const pageDetails = createAutofillPageDetailsMock({
      fields: [usernameField, passwordField, totpField],
    });

    const script = generateLoginFillScript(pageDetails, { ...credential, totp: "123456" }, options);

    expect(script.script.some(([, opid]) => opid === "t")).toBe(false);
  });
});
