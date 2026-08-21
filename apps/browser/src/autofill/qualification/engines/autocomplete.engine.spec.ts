import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { CUES_BY_KIND } from "../likelihood-ratios";
import { FieldRole, FormCategory, PageScenario, QualificationEngineId } from "../types";

import { AutocompleteQualificationEngine } from "./autocomplete.engine";

describe("AutocompleteQualificationEngine", () => {
  let engine: AutocompleteQualificationEngine;

  beforeEach(() => {
    engine = new AutocompleteQualificationEngine();
  });

  it("identifies itself so the engine bay can log and select it", () => {
    expect(engine.id).toBe(QualificationEngineId.Autocomplete);
    expect(engine.name).toBe("Autocomplete Attribute Engine");
    expect(engine.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("returns null lookups for a page with no fields", () => {
    const result = engine.classify(buildPageDetails({ fields: [], forms: {} }));

    expect(result.fieldFor("anything")).toBeNull();
    expect(result.formFor("anything")).toBeNull();
    expect(result.scenario()).toBeNull();
  });

  describe("field roles", () => {
    it("classifies a mapped token as certain", () => {
      const result = classifyOne({ autoCompleteType: "username" });

      expect(result?.topRole).toBe(FieldRole.Username);
      expect(result?.matchedRoles.has(FieldRole.Username)).toBe(true);
      expect(result?.confidence).toBe("certain");
      expect(result?.score).toBe(1);
    });

    it("reads a token out of a multi-token attribute", () => {
      const result = classifyOne({ autoCompleteType: "section-blue shipping given-name" });

      expect(result?.topRole).toBe(FieldRole.IdentityFirstName);
    });

    it("is case-insensitive", () => {
      const result = classifyOne({ autoCompleteType: "Current-Password" });

      expect(result?.topRole).toBe(FieldRole.CurrentPassword);
    });

    it("classifies nothing when the attribute is absent", () => {
      // A field the scoring engine would happily classify from its id and label.
      const result = classifyOne({ htmlID: "username", htmlName: "username", type: "text" });

      expect(result?.topRole).toBeNull();
      expect(result?.matchedRoles.size).toBe(0);
      expect(result?.confidence).toBe("none");
      expect(result?.score).toBe(0);
    });

    it("classifies nothing for autocomplete=off", () => {
      const result = classifyOne({ autoCompleteType: "off", htmlID: "username" });

      expect(result?.topRole).toBeNull();
    });

    it("does not claim updateCurrentPassword, so it falls through to legacy", () => {
      // The attribute has no token for it — the distinction is contextual. The
      // adapter routes uncovered roles to the legacy service, and this is the
      // role that makes that visible.
      expect(engine.coveredRoles.has(FieldRole.UpdateCurrentPassword)).toBe(false);
    });

    it("declares coverage for every role its table can emit", () => {
      const emitted = new Set<FieldRole>();
      for (const token of ALL_MAPPED_TOKENS) {
        const role = classifyOne({ autoCompleteType: token })?.topRole;
        if (role !== null && role !== undefined) {
          emitted.add(role);
        }
      }

      expect([...emitted].sort()).toEqual([...engine.coveredRoles].sort());
    });
  });

  describe("form categories", () => {
    it("derives Login from username plus current-password", () => {
      const result = classifyForm(["username", "current-password"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.Login)).toBe(true);
      expect(result.scenario()).toBe(PageScenario.LoginPage);
    });

    it("derives Login from email plus current-password", () => {
      const result = classifyForm(["email", "current-password"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.Login)).toBe(true);
    });

    it("does not derive Login from a lone password field", () => {
      const result = classifyForm(["current-password"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.Login)).toBe(false);
    });

    it("derives AccountCreation from new-password", () => {
      const result = classifyForm(["username", "new-password"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.AccountCreation)).toBe(
        true,
      );
      expect(result.scenario()).toBe(PageScenario.RegistrationPage);
    });

    it("derives CreditCard from any cc token", () => {
      const result = classifyForm(["cc-number", "cc-exp", "cc-csc"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.CreditCard)).toBe(
        true,
      );
      expect(result.scenario()).toBe(PageScenario.CheckoutPage);
    });

    it("derives Identity from identity tokens", () => {
      const result = classifyForm(["given-name", "family-name", "postal-code"]);

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.Identity)).toBe(true);
      expect(result.scenario()).toBe(PageScenario.ProfilePage);
    });

    it("keeps two forms on one page from blending into each other", () => {
      const login = buildForm({ opid: "__form__0" });
      const checkout = buildForm({ opid: "__form__1" });
      const result = engine.classify(
        buildPageDetails({
          fields: [
            buildField({ opid: "u", form: "__form__0", autoCompleteType: "username" }),
            buildField({ opid: "p", form: "__form__0", autoCompleteType: "current-password" }),
            buildField({ opid: "cc", form: "__form__1", autoCompleteType: "cc-number" }),
          ],
          forms: { __form__0: login, __form__1: checkout },
        }),
      );

      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.Login)).toBe(true);
      expect(result.formFor("__form__0")?.matchedCategories.has(FormCategory.CreditCard)).toBe(
        false,
      );
      expect(result.formFor("__form__1")?.matchedCategories.has(FormCategory.CreditCard)).toBe(
        true,
      );
      expect(result.formFor("__form__1")?.matchedCategories.has(FormCategory.Login)).toBe(false);
    });

    it("sets a field's form context only when its own role agrees with the form", () => {
      const result = classifyForm(["username", "current-password", "country"]);

      // The credential fields belong to the login context.
      expect(result.fieldFor("f0")?.matchedFormContexts.has(FormCategory.Login)).toBe(true);
      // The stray country dropdown does not, even though it shares the form.
      expect(result.fieldFor("f2")?.matchedFormContexts.has(FormCategory.Login)).toBe(false);
    });

    it("prefers the more specific scenario when a page carries several", () => {
      // A checkout page that also has an address block is a checkout page.
      const result = classifyForm(["cc-number", "given-name", "postal-code"]);

      expect(result.scenario()).toBe(PageScenario.CheckoutPage);
    });
  });

  describe("drift guard", () => {
    // The engine keeps its own readable token table on purpose — legibility is
    // the whole point of this engine. This test is what stops that table from
    // silently diverging from the scoring engine's autocomplete cues.
    it("maps every autocomplete token the scoring engine scores", () => {
      const missing: string[] = [];

      for (const [role, cues] of Object.entries(CUES_BY_KIND)) {
        for (const cue of cues ?? []) {
          if (cue.signal !== "autocomplete") {
            continue;
          }
          const mapped = classifyOne({ autoCompleteType: cue.token })?.topRole;
          if (mapped !== role) {
            missing.push(`${cue.token} -> expected ${role}, got ${mapped ?? "null"}`);
          }
        }
      }

      // IdentityEmail and IdentityUsername have no autocomplete cues at all, so
      // they never enter this loop — see the note in likelihood-ratios.ts.
      expect(missing).toEqual([]);
    });
  });
});

const ALL_MAPPED_TOKENS: ReadonlyArray<string> = [
  "username",
  "email",
  "current-password",
  "new-password",
  "one-time-code",
  "cc-name",
  "ccname",
  "cc-number",
  "ccnumber",
  "cc-exp",
  "ccexp",
  "cc-exp-month",
  "ccexpmonth",
  "cc-exp-year",
  "ccexpyear",
  "cc-csc",
  "cccsc",
  "cc-type",
  "cctype",
  "honorific-prefix",
  "given-name",
  "additional-name",
  "family-name",
  "name",
  "street-address",
  "address-line1",
  "address-line2",
  "address-line3",
  "address-level2",
  "address-level1",
  "postal-code",
  "country",
  "country-name",
  "organization",
  "tel",
];

const helperEngine = new AutocompleteQualificationEngine();

function classifyOne(args: FieldArgs) {
  const field = buildField({ opid: "only", form: "__form__0", ...args });
  const result = helperEngine.classify(
    buildPageDetails({ fields: [field], forms: { __form__0: buildForm({ opid: "__form__0" }) } }),
  );
  return result.fieldFor("only");
}

function classifyForm(tokens: string[]) {
  const fields = tokens.map((token, i) =>
    buildField({ opid: `f${i}`, form: "__form__0", autoCompleteType: token, elementNumber: i }),
  );
  return helperEngine.classify(
    buildPageDetails({ fields, forms: { __form__0: buildForm({ opid: "__form__0" }) } }),
  );
}

type FieldArgs = {
  opid?: string;
  form?: string | null;
  elementNumber?: number;
  type?: string;
  htmlID?: string;
  htmlName?: string;
  autoCompleteType?: string;
};

function buildPageDetails(args: {
  fields: AutofillField[];
  forms: { [opid: string]: AutofillForm };
}): AutofillPageDetails {
  const pd = new AutofillPageDetails();
  pd.title = "Sign in";
  pd.url = "https://example.test/login";
  pd.documentUrl = pd.url;
  pd.fields = args.fields;
  pd.forms = args.forms;
  pd.collectedTimestamp = 0;
  return pd;
}

function buildForm(args: { opid: string }): AutofillForm {
  const f = new AutofillForm();
  f.opid = args.opid;
  f.htmlName = "";
  f.htmlID = "";
  f.htmlAction = "";
  f.htmlMethod = "post";
  f.htmlClass = "";
  f.htmlAncestorHeadings = [];
  f.submitButtonText = [];
  return f;
}

function buildField(args: FieldArgs): AutofillField {
  const f = new AutofillField();
  f.opid = args.opid ?? "only";
  f.elementNumber = args.elementNumber ?? 0;
  f.viewable = true;
  f.htmlID = args.htmlID ?? null;
  f.htmlName = args.htmlName ?? null;
  f.htmlClass = null;
  f.tabindex = null;
  f.title = null;
  f.type = args.type ?? "text";
  f.form = args.form ?? null;
  f.autoCompleteType = args.autoCompleteType ?? null;
  return f;
}
