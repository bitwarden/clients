import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";

import { ScoringQualificationEngine } from "./engine";
import {
  CategoryScore,
  ClassificationReason,
  FieldRole,
  FormCategory,
  PageScenario,
  RoleScore,
  ScoringEngineTrace,
} from "./types";

describe("ScoringQualificationEngine", () => {
  let engine: ScoringQualificationEngine;

  beforeEach(() => {
    engine = new ScoringQualificationEngine();
  });

  it("returns null lookups for a page with no fields", () => {
    const result = engine.classify(buildPageDetails({ fields: [], forms: {} }));

    expect(result.fieldFor("anything")).toBeNull();
    expect(result.formFor("anything")).toBeNull();
    expect(result.scenario()).toBeNull();
  });

  it("classifies a simple login form", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      htmlID: "username",
      htmlName: "username",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      htmlID: "password",
      htmlName: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, password], forms: { __form__0: form } }),
    );

    const u = result.fieldFor("u");
    expect(u?.topRole).toBe(FieldRole.Username);
    expect(u?.matchedRoles.has(FieldRole.Username)).toBe(true);
    expect(u?.confidence === "certain" || u?.confidence === "high").toBe(true);

    const p = result.fieldFor("p");
    expect(p?.topRole).toBe(FieldRole.CurrentPassword);
    expect(p?.matchedRoles.has(FieldRole.CurrentPassword)).toBe(true);

    const fr = result.formFor("__form__0");
    expect(fr?.topCategory).toBe(FormCategory.Login);
    expect(fr?.matchedCategories.has(FormCategory.Login)).toBe(true);
    expect(fr?.confidence).not.toBe("none");
    expect(fr?.confidence).not.toBe("disqualified");

    expect(result.scenario()).toBe(PageScenario.LoginPage);
  });

  it("propagates the form's matched categories onto each field as matchedFormContexts", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, password], forms: { __form__0: form } }),
    );

    expect(result.fieldFor("u")?.matchedFormContexts.has(FormCategory.Login)).toBe(true);
    expect(result.fieldFor("p")?.matchedFormContexts.has(FormCategory.Login)).toBe(true);
  });

  it("clusters six maxLength=1 inputs into a single OTP field", () => {
    const form = buildForm({ opid: "__form__0" });
    const otpFields = [0, 1, 2, 3, 4, 5].map((i) =>
      buildField({
        opid: `otp${i}`,
        form: "__form__0",
        elementNumber: i,
        type: "text",
        maxLength: 1,
        htmlID: `otp-${i}`,
        htmlName: `otp-${i}`,
        autoCompleteType: i === 0 ? "one-time-code" : undefined,
        viewable: true,
      }),
    );

    const result = engine.classify(
      buildPageDetails({ fields: otpFields, forms: { __form__0: form } }),
    );

    for (let i = 0; i < 6; i++) {
      const record = result.fieldFor(`otp${i}`);
      expect(record?.matchedRoles.has(FieldRole.Totp)).toBe(true);
      const trace = record?.trace as ScoringEngineTrace | undefined;
      expect(trace?.cluster?.id).toBe("otp0");
      expect(trace?.cluster?.shape).toBe("split-by-position");
      expect(trace?.cluster?.total).toBe(6);
      expect(trace?.cluster?.position).toBe(i);
    }
  });

  it("returns the full per-role score array for each classified field", () => {
    const form = buildForm({ opid: "__form__0" });
    const ambiguous = buildField({
      opid: "x",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      htmlID: "user-or-email",
      htmlName: "userOrEmail",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [ambiguous], forms: { __form__0: form } }),
    );

    const record = result.fieldFor("x");
    expect(record).not.toBeNull();
    expect(record!.allScores.length).toBeGreaterThan(1);
    for (const rs of record!.allScores) {
      expect(rs.score).toBeGreaterThan(0);
    }
  });

  it("classifies a form-less password input", () => {
    const password = buildField({
      opid: "p",
      form: null,
      elementNumber: 0,
      type: "password",
      htmlID: "password",
      htmlName: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(buildPageDetails({ fields: [password], forms: {} }));

    expect(result.fieldFor("p")?.topRole).toBe(FieldRole.CurrentPassword);
    expect(result.formFor("anything")).toBeNull();
  });

  it("excludes hidden and submit fields from classification", () => {
    const hidden = buildField({ opid: "h", form: null, elementNumber: 0, type: "hidden" });
    const submit = buildField({ opid: "s", form: null, elementNumber: 1, type: "submit" });

    const result = engine.classify(buildPageDetails({ fields: [hidden, submit], forms: {} }));

    expect(result.fieldFor("h")).toBeNull();
    expect(result.fieldFor("s")).toBeNull();
  });

  it("classifies an account-creation form with new + confirm password", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "newPassword",
      htmlName: "newPassword",
      viewable: true,
    });
    const confirmPassword = buildField({
      opid: "cp",
      form: "__form__0",
      elementNumber: 2,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "confirmPassword",
      htmlName: "confirmPassword",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, newPassword, confirmPassword],
        forms: { __form__0: form },
      }),
    );

    expect(result.fieldFor("np")?.matchedRoles.has(FieldRole.NewPassword)).toBe(true);
    expect(result.fieldFor("cp")?.matchedRoles.has(FieldRole.NewPassword)).toBe(true);
    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.AccountCreation);
    expect(result.scenario()).toBe(PageScenario.RegistrationPage);
  });

  it("returns null scenario when a login form and a signup form coexist (mixed)", () => {
    const loginForm = buildForm({ opid: "__form__0" });
    const signupForm = buildForm({ opid: "__form__1" });
    const fields = [
      buildField({
        opid: "lu",
        form: "__form__0",
        elementNumber: 0,
        type: "text",
        autoCompleteType: "username",
        viewable: true,
      }),
      buildField({
        opid: "lp",
        form: "__form__0",
        elementNumber: 1,
        type: "password",
        autoCompleteType: "current-password",
        viewable: true,
      }),
      buildField({
        opid: "su",
        form: "__form__1",
        elementNumber: 2,
        type: "text",
        autoCompleteType: "username",
        viewable: true,
      }),
      buildField({
        opid: "snp",
        form: "__form__1",
        elementNumber: 3,
        type: "password",
        autoCompleteType: "new-password",
        viewable: true,
      }),
    ];

    const result = engine.classify(
      buildPageDetails({
        fields,
        forms: { __form__0: loginForm, __form__1: signupForm },
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
    expect(result.formFor("__form__1")?.topCategory).toBe(FormCategory.AccountCreation);
    expect(result.scenario()).toBeNull();
  });

  it("rejects account-login when a newPassword field is present", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, newPassword], forms: { __form__0: form } }),
    );

    const loginScore = scoreFor(result.formFor("__form__0")?.allScores ?? [], FormCategory.Login);
    expect(loginScore).toBeLessThan(0.01);
  });

  it("lifts a weakly-classified login form via ambient page signals", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Sign in to your account"],
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      htmlID: "field1",
      htmlName: "field1",
      labelTag: "Username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      htmlID: "field2",
      htmlName: "field2",
      labelTag: "Password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, password],
        forms: { __form__0: form },
        url: "https://example.test/login",
        title: "Sign in",
      }),
    );

    const fr = result.formFor("__form__0");
    expect(fr?.topCategory).toBe(FormCategory.Login);
    expect(fr?.score ?? 0).toBeGreaterThan(0.5);
  });

  it("lifts an account-creation form via 'Create account' ambient signals", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Create your account"],
      htmlAction: "/signup",
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, newPassword],
        forms: { __form__0: form },
        url: "https://example.test/signup",
        title: "Create your account",
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.AccountCreation);
    expect(result.scenario()).toBe(PageScenario.RegistrationPage);
  });

  it("does not let ambient signals lift a forbidden-vetoed archetype", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Sign in"],
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, newPassword],
        forms: { __form__0: form },
        url: "https://example.test/signin",
        title: "Sign in",
      }),
    );

    const loginScore = scoreFor(result.formFor("__form__0")?.allScores ?? [], FormCategory.Login);
    expect(loginScore).toBeLessThan(0.01);
  });

  it("classifies a field with autocomplete=email as email, not username", () => {
    const form = buildForm({ opid: "__form__0" });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [email], forms: { __form__0: form } }),
    );

    expect(result.fieldFor("e")?.topRole).toBe(FieldRole.Email);
  });

  it("accepts email as the user-identifier slot of an account-login form", () => {
    const form = buildForm({ opid: "__form__0" });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [email, password], forms: { __form__0: form } }),
    );

    expect(result.fieldFor("e")?.topRole).toBe(FieldRole.Email);
    expect(result.fieldFor("p")?.topRole).toBe(FieldRole.CurrentPassword);
    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
    expect(result.scenario()).toBe(PageScenario.LoginPage);
  });

  it("accepts email + new-password as an account-creation form", () => {
    const form = buildForm({ opid: "__form__0" });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [email, newPassword], forms: { __form__0: form } }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.AccountCreation);
  });

  it("does not let a 'Registered users' heading boost the account-creation archetype", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Registered users sign in here"],
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, password],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
    const creationScore = scoreFor(
      result.formFor("__form__0")?.allScores ?? [],
      FormCategory.AccountCreation,
    );
    expect(creationScore).toBeLessThan(0.01);
  });

  it("matches a standalone 'Sign in' heading as ambient evidence for login", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Sign in"],
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      htmlID: "f1",
      labelTag: "Username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      htmlID: "f2",
      labelTag: "Password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, password],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
  });

  it("classifies a text input with inputmode=email as email", () => {
    const form = buildForm({ opid: "__form__0" });
    const field = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      inputMode: "email",
      htmlID: "user",
      htmlName: "user",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [field], forms: { __form__0: form } }),
    );

    expect(result.fieldFor("e")?.topRole).toBe(FieldRole.Email);
  });

  it("lifts a weak login form via a 'Sign in' submit button", () => {
    const form = buildForm({
      opid: "__form__0",
      submitButtonText: ["Sign in"],
    });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      htmlID: "f1",
      labelTag: "Username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      htmlID: "f2",
      labelTag: "Password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [username, password],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
  });

  it("lifts an account-creation form via a 'Create account' submit button", () => {
    const form = buildForm({
      opid: "__form__0",
      submitButtonText: ["Create account"],
    });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [email, newPassword],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.AccountCreation);
    expect(result.scenario()).toBe(PageScenario.RegistrationPage);
  });

  it("emits field-cue trace explaining each field classification", () => {
    const form = buildForm({ opid: "__form__0" });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 0,
      type: "password",
      autoCompleteType: "current-password",
      htmlID: "password",
      htmlName: "password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [password], forms: { __form__0: form } }),
    );

    const trace = result.fieldFor("p")?.trace as ScoringEngineTrace | undefined;
    expect(trace?.reasons.length ?? 0).toBeGreaterThan(0);
    const autocompleteReason = trace?.reasons.find(
      (r) => r.type === "field-cue" && r.slot === "autocomplete",
    );
    expect(autocompleteReason).toMatchObject({
      type: "field-cue",
      contributedTo: "currentPassword",
      fieldOpid: "p",
      slot: "autocomplete",
      matchedToken: "current-password",
    });
  });

  it("emits archetype-matcher trace explaining form classification", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, password], forms: { __form__0: form } }),
    );

    const trace = result.formFor("__form__0")?.trace as ScoringEngineTrace | undefined;
    expect(trace).toBeDefined();
    const satisfiedMatchers = (trace?.reasons ?? []).filter(
      (r): r is Extract<ClassificationReason, { type: "archetype-matcher" }> =>
        r.type === "archetype-matcher" && r.outcome === "satisfied",
    );
    expect(satisfiedMatchers.length).toBeGreaterThanOrEqual(2);
    const passwordMatcher = satisfiedMatchers.find(
      (r) => r.contributedTo === "account-login" && r.matcherKinds.includes("currentPassword"),
    );
    expect(passwordMatcher).toBeDefined();
    expect(passwordMatcher!.matchedFieldOpids).toContain("p");
  });

  it("emits a 'vetoed' reason when a forbidden matcher blocks an archetype", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, newPassword], forms: { __form__0: form } }),
    );

    const trace = result.formFor("__form__0")?.trace as ScoringEngineTrace | undefined;
    const vetoReason = (trace?.reasons ?? []).find(
      (r): r is Extract<ClassificationReason, { type: "archetype-matcher" }> =>
        r.type === "archetype-matcher" &&
        r.contributedTo === "account-login" &&
        r.outcome === "vetoed",
    );
    expect(vetoReason).toBeDefined();
    expect(vetoReason!.matchedFieldOpids).toContain("np");
  });

  it("emits ambient-cue reasons with the raw matched source", () => {
    const form = buildForm({
      opid: "__form__0",
      submitButtonText: ["Create account"],
    });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [email, newPassword],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    const trace = result.formFor("__form__0")?.trace as ScoringEngineTrace | undefined;
    const ambientReason = (trace?.reasons ?? []).find(
      (r) =>
        r.type === "ambient-cue" &&
        r.contributedTo === "account-creation" &&
        r.slot === "submitButtonText",
    );
    expect(ambientReason).toMatchObject({
      type: "ambient-cue",
      contributedTo: "account-creation",
      slot: "submitButtonText",
      raw: "Create account",
      matchedToken: "createaccount",
    });
  });

  it("augments the current-password field with UpdateCurrentPassword on a change-password form", () => {
    const form = buildForm({ opid: "__form__0" });
    const currentPassword = buildField({
      opid: "cp",
      form: "__form__0",
      elementNumber: 0,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [currentPassword, newPassword],
        forms: { __form__0: form },
        url: "https://example.test/settings/password",
        title: "Account",
      }),
    );

    const cp = result.fieldFor("cp");
    expect(cp?.matchedRoles.has(FieldRole.CurrentPassword)).toBe(true);
    expect(cp?.matchedRoles.has(FieldRole.UpdateCurrentPassword)).toBe(true);
    expect(cp?.topRole).toBe(FieldRole.CurrentPassword);

    const np = result.fieldFor("np");
    expect(np?.matchedRoles.has(FieldRole.UpdateCurrentPassword)).toBe(false);
    expect(np?.matchedRoles.has(FieldRole.NewPassword)).toBe(true);
  });

  it("does not augment with UpdateCurrentPassword on a regular login form", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, password], forms: { __form__0: form } }),
    );

    const p = result.fieldFor("p");
    expect(p?.matchedRoles.has(FieldRole.CurrentPassword)).toBe(true);
    expect(p?.matchedRoles.has(FieldRole.UpdateCurrentPassword)).toBe(false);
  });

  it("classifies a change-password form (no shipped FormCategory) and surfaces the page scenario", () => {
    const form = buildForm({ opid: "__form__0" });
    const currentPassword = buildField({
      opid: "cp",
      form: "__form__0",
      elementNumber: 0,
      type: "password",
      autoCompleteType: "current-password",
      htmlID: "currentPassword",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "newPassword",
      viewable: true,
    });
    const confirmPassword = buildField({
      opid: "cnp",
      form: "__form__0",
      elementNumber: 2,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "confirmPassword",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [currentPassword, newPassword, confirmPassword],
        forms: { __form__0: form },
        url: "https://example.test/settings/password",
        title: "Account",
      }),
    );

    const trace = result.formFor("__form__0")?.trace as ScoringEngineTrace | undefined;
    expect(trace?.internalKind).toBe("account-update");
    expect(result.scenario()).toBe(PageScenario.PasswordChangePage);
  });

  it("does not classify a pure login form as account-update", () => {
    const form = buildForm({ opid: "__form__0" });
    const username = buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      viewable: true,
    });
    const password = buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({ fields: [username, password], forms: { __form__0: form } }),
    );

    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.Login);
  });

  it("classifies a 'set new password' form (no user-identifier) — internalKind account-recovery", () => {
    const form = buildForm({ opid: "__form__0" });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 0,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "newPassword",
      viewable: true,
    });
    const confirmPassword = buildField({
      opid: "cnp",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "confirmPassword",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [newPassword, confirmPassword],
        forms: { __form__0: form },
        url: "https://example.test/account",
        title: "Account",
      }),
    );

    const trace = result.formFor("__form__0")?.trace as ScoringEngineTrace | undefined;
    expect(trace?.internalKind).toBe("account-recovery");
    expect(result.scenario()).toBe(PageScenario.PasswordChangePage);
  });

  it("declares the FieldRoles and FormCategories it covers", () => {
    expect(engine.coveredRoles).toEqual(
      new Set([
        FieldRole.Username,
        FieldRole.Email,
        FieldRole.CurrentPassword,
        FieldRole.UpdateCurrentPassword,
        FieldRole.NewPassword,
        FieldRole.Totp,
        FieldRole.CardholderName,
        FieldRole.CardNumber,
        FieldRole.CardExpirationDate,
        FieldRole.CardExpirationMonth,
        FieldRole.CardExpirationYear,
        FieldRole.CardCvv,
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
        FieldRole.IdentityEmail,
        FieldRole.IdentityUsername,
      ]),
    );
    expect(engine.coveredCategories).toEqual(
      new Set([
        FormCategory.Login,
        FormCategory.AccountCreation,
        FormCategory.CreditCard,
        FormCategory.Identity,
      ]),
    );
  });

  it("never emits roles outside coveredRoles", () => {
    const fields = [
      buildField({
        opid: "u",
        form: "__form__0",
        elementNumber: 0,
        type: "text",
        autoCompleteType: "username",
        viewable: true,
      }),
      buildField({
        opid: "p",
        form: "__form__0",
        elementNumber: 1,
        type: "password",
        autoCompleteType: "current-password",
        viewable: true,
      }),
      buildField({
        opid: "e",
        form: "__form__0",
        elementNumber: 2,
        type: "email",
        autoCompleteType: "email",
        viewable: true,
      }),
      buildField({
        opid: "n",
        form: "__form__0",
        elementNumber: 3,
        type: "password",
        autoCompleteType: "new-password",
        viewable: true,
      }),
      buildField({
        opid: "o",
        form: "__form__0",
        elementNumber: 4,
        type: "text",
        autoCompleteType: "one-time-code",
        maxLength: 6,
        viewable: true,
      }),
    ];

    const result = engine.classify(
      buildPageDetails({
        fields,
        forms: { __form__0: buildForm({ opid: "__form__0" }) },
      }),
    );

    for (const field of fields) {
      const classification = result.fieldFor(field.opid);
      if (classification === null) {
        continue;
      }
      for (const role of classification.matchedRoles) {
        expect(engine.coveredRoles.has(role)).toBe(true);
      }
      if (classification.topRole !== null) {
        expect(engine.coveredRoles.has(classification.topRole)).toBe(true);
      }
    }
  });

  it("classifies a credit-card form as payment-card with checkout-page scenario", () => {
    const form = buildForm({ opid: "__form__0", submitButtonText: ["Pay now"] });
    const cardholder = buildField({
      opid: "ch",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "cc-name",
      htmlID: "cardholderName",
      htmlName: "cardholderName",
      viewable: true,
    });
    const cardNumber = buildField({
      opid: "cn",
      form: "__form__0",
      elementNumber: 1,
      type: "text",
      autoCompleteType: "cc-number",
      htmlID: "cardNumber",
      htmlName: "cardNumber",
      viewable: true,
    });
    const cardExp = buildField({
      opid: "ce",
      form: "__form__0",
      elementNumber: 2,
      type: "text",
      autoCompleteType: "cc-exp",
      htmlID: "cardExpiration",
      htmlName: "cardExpiration",
      viewable: true,
    });
    const cardCvv = buildField({
      opid: "cv",
      form: "__form__0",
      elementNumber: 3,
      type: "text",
      autoCompleteType: "cc-csc",
      htmlID: "cardCvv",
      htmlName: "cardCvv",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [cardholder, cardNumber, cardExp, cardCvv],
        forms: { __form__0: form },
        url: "https://example.test/checkout",
        title: "Checkout",
      }),
    );

    expect(result.fieldFor("ch")?.topRole).toBe(FieldRole.CardholderName);
    expect(result.fieldFor("cn")?.topRole).toBe(FieldRole.CardNumber);
    expect(result.fieldFor("ce")?.topRole).toBe(FieldRole.CardExpirationDate);
    expect(result.fieldFor("cv")?.topRole).toBe(FieldRole.CardCvv);

    const formRecord = result.formFor("__form__0");
    expect(formRecord?.topCategory).toBe(FormCategory.CreditCard);
    expect(formRecord?.matchedCategories.has(FormCategory.CreditCard)).toBe(true);

    expect(result.scenario()).toBe(PageScenario.CheckoutPage);
  });

  it("classifies a credit-card form with split expiry month + year", () => {
    const form = buildForm({ opid: "__form__0" });
    const cardholder = buildField({
      opid: "ch",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "cc-name",
      viewable: true,
    });
    const cardNumber = buildField({
      opid: "cn",
      form: "__form__0",
      elementNumber: 1,
      type: "text",
      autoCompleteType: "cc-number",
      viewable: true,
    });
    const cardExpMonth = buildField({
      opid: "cem",
      form: "__form__0",
      elementNumber: 2,
      type: "text",
      autoCompleteType: "cc-exp-month",
      viewable: true,
    });
    const cardExpYear = buildField({
      opid: "cey",
      form: "__form__0",
      elementNumber: 3,
      type: "text",
      autoCompleteType: "cc-exp-year",
      viewable: true,
    });
    const cardCvv = buildField({
      opid: "cv",
      form: "__form__0",
      elementNumber: 4,
      type: "text",
      autoCompleteType: "cc-csc",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [cardholder, cardNumber, cardExpMonth, cardExpYear, cardCvv],
        forms: { __form__0: form },
        url: "https://example.test/checkout",
        title: "Checkout",
      }),
    );

    expect(result.fieldFor("cem")?.topRole).toBe(FieldRole.CardExpirationMonth);
    expect(result.fieldFor("cey")?.topRole).toBe(FieldRole.CardExpirationYear);
    expect(result.formFor("__form__0")?.topCategory).toBe(FormCategory.CreditCard);
  });

  it("matches a combined signup + checkout form as both AccountCreation and CreditCard", () => {
    const form = buildForm({ opid: "__form__0", submitButtonText: ["Create account & pay"] });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });
    const newPassword = buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      viewable: true,
    });
    const cardNumber = buildField({
      opid: "cn",
      form: "__form__0",
      elementNumber: 2,
      type: "text",
      autoCompleteType: "cc-number",
      viewable: true,
    });
    const cardExp = buildField({
      opid: "ce",
      form: "__form__0",
      elementNumber: 3,
      type: "text",
      autoCompleteType: "cc-exp",
      viewable: true,
    });
    const cardCvv = buildField({
      opid: "cv",
      form: "__form__0",
      elementNumber: 4,
      type: "text",
      autoCompleteType: "cc-csc",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [email, newPassword, cardNumber, cardExp, cardCvv],
        forms: { __form__0: form },
        url: "https://example.test/signup-and-checkout",
        title: "Create your account",
      }),
    );

    const formRecord = result.formFor("__form__0");
    expect(formRecord?.matchedCategories.has(FormCategory.AccountCreation)).toBe(true);
    expect(formRecord?.matchedCategories.has(FormCategory.CreditCard)).toBe(true);
  });

  it("classifies an identity (shipping address) form", () => {
    const form = buildForm({ opid: "__form__0", submitButtonText: ["Save address"] });
    const fields = [
      buildField({
        opid: "fn",
        form: "__form__0",
        elementNumber: 0,
        type: "text",
        autoCompleteType: "given-name",
        viewable: true,
      }),
      buildField({
        opid: "ln",
        form: "__form__0",
        elementNumber: 1,
        type: "text",
        autoCompleteType: "family-name",
        viewable: true,
      }),
      buildField({
        opid: "a1",
        form: "__form__0",
        elementNumber: 2,
        type: "text",
        autoCompleteType: "street-address",
        viewable: true,
      }),
      buildField({
        opid: "ct",
        form: "__form__0",
        elementNumber: 3,
        type: "text",
        autoCompleteType: "address-level2",
        viewable: true,
      }),
      buildField({
        opid: "pc",
        form: "__form__0",
        elementNumber: 4,
        type: "text",
        autoCompleteType: "postal-code",
        viewable: true,
      }),
    ];

    const result = engine.classify(
      buildPageDetails({
        fields,
        forms: { __form__0: form },
        url: "https://example.test/account/shipping",
        title: "Shipping address",
      }),
    );

    expect(result.fieldFor("fn")?.topRole).toBe(FieldRole.IdentityFirstName);
    expect(result.fieldFor("ln")?.topRole).toBe(FieldRole.IdentityLastName);
    expect(result.fieldFor("a1")?.topRole).toBe(FieldRole.IdentityAddress1);
    expect(result.fieldFor("ct")?.topRole).toBe(FieldRole.IdentityCity);
    expect(result.fieldFor("pc")?.topRole).toBe(FieldRole.IdentityPostalCode);

    const formRecord = result.formFor("__form__0");
    expect(formRecord?.matchedCategories.has(FormCategory.Identity)).toBe(true);
    expect(formRecord?.topCategory).toBe(FormCategory.Identity);
    expect(result.scenario()).toBe(PageScenario.ProfilePage);
  });

  it("classifies a combined shipping address + payment-card checkout form", () => {
    const form = buildForm({ opid: "__form__0", submitButtonText: ["Place order"] });
    const fields = [
      buildField({
        opid: "fn",
        form: "__form__0",
        elementNumber: 0,
        type: "text",
        autoCompleteType: "given-name",
        viewable: true,
      }),
      buildField({
        opid: "ln",
        form: "__form__0",
        elementNumber: 1,
        type: "text",
        autoCompleteType: "family-name",
        viewable: true,
      }),
      buildField({
        opid: "a1",
        form: "__form__0",
        elementNumber: 2,
        type: "text",
        autoCompleteType: "street-address",
        viewable: true,
      }),
      buildField({
        opid: "pc",
        form: "__form__0",
        elementNumber: 3,
        type: "text",
        autoCompleteType: "postal-code",
        viewable: true,
      }),
      buildField({
        opid: "cn",
        form: "__form__0",
        elementNumber: 4,
        type: "text",
        autoCompleteType: "cc-number",
        viewable: true,
      }),
      buildField({
        opid: "ce",
        form: "__form__0",
        elementNumber: 5,
        type: "text",
        autoCompleteType: "cc-exp",
        viewable: true,
      }),
    ];

    const result = engine.classify(
      buildPageDetails({
        fields,
        forms: { __form__0: form },
        url: "https://example.test/checkout",
        title: "Checkout",
      }),
    );

    const formRecord = result.formFor("__form__0");
    expect(formRecord?.matchedCategories.has(FormCategory.Identity)).toBe(true);
    expect(formRecord?.matchedCategories.has(FormCategory.CreditCard)).toBe(true);
  });

  it("classifies a newsletter signup as the signup archetype (no FormCategory boundary)", () => {
    const form = buildForm({
      opid: "__form__0",
      submitButtonText: ["Subscribe to our newsletter"],
    });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [email],
        forms: { __form__0: form },
        url: "https://example.test/newsletter",
        title: "Subscribe",
      }),
    );

    const formRecord = result.formFor("__form__0");
    expect(formRecord).not.toBeNull();
    // No shipped FormCategory maps to `signup`; the engine's internal kind shows
    // up in the trace for diagnostic surfaces. The form's matchedCategories is
    // empty for this archetype — that's correct.
    expect(formRecord!.matchedCategories.has(FormCategory.AccountCreation)).toBe(false);
    const trace = formRecord!.trace as { internalKind?: string } | undefined;
    expect(trace?.internalKind).toBe("signup");
  });

  it("classifies a 'forgot username' form as account-username-recovery internally", () => {
    const form = buildForm({
      opid: "__form__0",
      htmlAncestorHeadings: ["Forgot your username?"],
      submitButtonText: ["Find my account"],
    });
    const email = buildField({
      opid: "e",
      form: "__form__0",
      elementNumber: 0,
      type: "email",
      autoCompleteType: "email",
      viewable: true,
    });

    const result = engine.classify(
      buildPageDetails({
        fields: [email],
        forms: { __form__0: form },
        url: "https://example.test/recover/username",
        title: "Forgot your username?",
      }),
    );

    const formRecord = result.formFor("__form__0");
    const trace = formRecord?.trace as { internalKind?: string } | undefined;
    expect(trace?.internalKind).toBe("account-username-recovery");
  });

  it("is deterministic across repeated invocations", () => {
    const form = buildForm({ opid: "__form__0" });
    const fields = [
      buildField({
        opid: "u",
        form: "__form__0",
        elementNumber: 0,
        type: "text",
        autoCompleteType: "username",
        viewable: true,
      }),
      buildField({
        opid: "p",
        form: "__form__0",
        elementNumber: 1,
        type: "password",
        autoCompleteType: "current-password",
        viewable: true,
      }),
    ];
    const pd = buildPageDetails({ fields, forms: { __form__0: form } });
    const a = engine.classify(pd);
    const b = engine.classify(pd);

    expect(a.fieldFor("u")?.allScores).toEqual(b.fieldFor("u")?.allScores);
    expect(a.formFor("__form__0")?.allScores).toEqual(b.formFor("__form__0")?.allScores);
  });
});

function scoreFor(scores: ReadonlyArray<RoleScore | CategoryScore>, key: string): number {
  for (const s of scores) {
    if ("role" in s && s.role === key) {
      return s.score;
    }
    if ("category" in s && s.category === key) {
      return s.score;
    }
  }
  return 0;
}

function buildPageDetails(args: {
  fields: AutofillField[];
  forms: { [opid: string]: AutofillForm };
  title?: string;
  url?: string;
}): AutofillPageDetails {
  const pd = new AutofillPageDetails();
  pd.title = args.title ?? "Sign in";
  pd.url = args.url ?? "https://example.test/login";
  pd.documentUrl = pd.url;
  pd.fields = args.fields;
  pd.forms = args.forms;
  pd.collectedTimestamp = 0;
  return pd;
}

function buildForm(args: {
  opid: string;
  htmlAction?: string;
  htmlAncestorHeadings?: string[];
  submitButtonText?: string[];
}): AutofillForm {
  const f = new AutofillForm();
  f.opid = args.opid;
  f.htmlName = "";
  f.htmlID = "";
  f.htmlAction = args.htmlAction ?? "";
  f.htmlMethod = "post";
  f.htmlClass = "";
  f.htmlAncestorHeadings = args.htmlAncestorHeadings ?? [];
  f.submitButtonText = args.submitButtonText ?? [];
  return f;
}

function buildField(args: {
  opid: string;
  form: string | null;
  elementNumber: number;
  type?: string;
  htmlID?: string;
  htmlName?: string;
  htmlClass?: string;
  placeholder?: string;
  autoCompleteType?: string;
  maxLength?: number;
  viewable?: boolean;
  labelTag?: string;
  labelAria?: string;
  inputMode?: string;
}): AutofillField {
  const f = new AutofillField();
  f.opid = args.opid;
  f.elementNumber = args.elementNumber;
  f.viewable = args.viewable ?? true;
  f.htmlID = args.htmlID ?? null;
  f.htmlName = args.htmlName ?? null;
  f.htmlClass = args.htmlClass ?? null;
  f.tabindex = null;
  f.title = null;
  f.type = args.type;
  f.placeholder = args.placeholder ?? null;
  f.autoCompleteType = args.autoCompleteType ?? null;
  f.form = args.form;
  f.maxLength = args.maxLength ?? null;
  f.inputMode = args.inputMode ?? null;
  f["label-tag"] = args.labelTag;
  f["label-aria"] = args.labelAria;
  return f;
}
