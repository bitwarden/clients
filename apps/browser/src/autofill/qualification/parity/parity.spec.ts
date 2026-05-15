import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { InlineMenuFieldQualificationService } from "../../services/inline-menu-field-qualification.service";
import { LegacyBridgeEngine } from "../../services/qualification/engines/legacy-bridge.engine";
import { PageQualification } from "../abstractions/qualification-engine";
import { ScoringQualificationEngine } from "../engine";
import { FieldRole } from "../types/field-role";
import { FormCategory } from "../types/form-category";

type Fixture = {
  readonly name: string;
  readonly pageDetails: AutofillPageDetails;
  readonly fieldOpids: ReadonlyArray<string>;
  readonly formOpids: ReadonlyArray<string>;
};

type RoleDivergence = {
  readonly kind: "role";
  readonly opid: string;
  readonly role: FieldRole;
  readonly engine: boolean;
  readonly legacy: boolean;
};

type CategoryDivergence = {
  readonly kind: "category";
  readonly opid: string;
  readonly category: FormCategory;
  readonly engine: boolean;
  readonly legacy: boolean;
};

type FormContextDivergence = {
  readonly kind: "formContext";
  readonly opid: string;
  readonly category: FormCategory;
  readonly engine: boolean;
  readonly legacy: boolean;
};

type Divergence = RoleDivergence | CategoryDivergence | FormContextDivergence;

/**
 * Behavioural parity report: ScoringQualificationEngine vs LegacyBridgeEngine,
 * scoped to the roles/categories the scoring engine declares it covers.
 *
 * Divergences here are not bugs — they are signal. Each one represents a place
 * where the two engines disagree on a covered role, which is the seam this test
 * is designed to surface. The expected-divergence lists below document those
 * disagreements inline:
 *
 *   - **No documented divergence** means the engines must agree. Adding a new
 *     divergence by accident fails the test.
 *   - **A documented divergence** means we've inspected it, found it intentional
 *     (engine is smarter, engine is more conservative, etc.), and accept it.
 *     The test still asserts the divergence is *exactly* what's documented;
 *     drift on a known-divergent assertion also fails.
 *
 * When activating `useEngine=true` in a new consumer surface, audit the
 * documented divergences against that consumer's expectations.
 */
describe("Engine ↔ LegacyBridge parity (credential roles)", () => {
  let scoring: ScoringQualificationEngine;
  let bridge: LegacyBridgeEngine;

  beforeEach(() => {
    scoring = new ScoringQualificationEngine();
    bridge = new LegacyBridgeEngine(new InlineMenuFieldQualificationService());
  });

  // Both login and signup fixtures share an identity-username divergence:
  //
  //   Legacy's `isFieldForIdentityUsername` returns true for any field whose
  //   attributes contain "username"-like tokens — it doesn't distinguish a
  //   credential username from a profile/handle/screen-name. The scoring
  //   engine narrows IdentityUsername to specifically identity-context tokens
  //   (screenname, handle, displayname, nickname); a plain `htmlName="username"`
  //   credential field doesn't match.
  //
  //   This is the engine being strictly more precise than legacy. The cascade
  //   from the field-level miss propagates into the form's `matchedCategories.Identity`
  //   (legacy thinks the form has identity content because of `u.identityUsername`).
  const identityUsernameDivergences = (fieldOpid: string, formOpid: string): Divergence[] => [
    {
      kind: "role",
      opid: fieldOpid,
      role: FieldRole.IdentityUsername,
      engine: false,
      legacy: true,
    },
    {
      kind: "formContext",
      opid: fieldOpid,
      category: FormCategory.Identity,
      engine: false,
      legacy: true,
    },
    {
      kind: "category",
      opid: formOpid,
      category: FormCategory.Identity,
      engine: false,
      legacy: true,
    },
  ];

  describe("login (username + current-password)", () => {
    const fixture = loginFixture();
    const expectedDivergences = identityUsernameDivergences("u", "__form__0");

    it("has the documented divergences and nothing more", () => {
      const divergences = compareEngines(scoring, bridge, fixture);
      expect(sortDivergences(divergences)).toEqual(sortDivergences(expectedDivergences));
    });
  });

  describe("signup (username + new-password + confirm)", () => {
    const fixture = signupFixture();
    const expectedDivergences = identityUsernameDivergences("u", "__form__0");

    it("has the documented divergences and nothing more", () => {
      const divergences = compareEngines(scoring, bridge, fixture);
      expect(sortDivergences(divergences)).toEqual(sortDivergences(expectedDivergences));
    });
  });

  describe("change-password (current + new + confirm, camelCase htmlID only)", () => {
    const fixture = changePasswordFixture();

    // The fixture exercises a change-password form where the password fields have
    // only camelCase htmlIDs — no spaced "current password" labels. Legacy's
    // keyword-based check requires a token like "current password" (with a space)
    // in the field's tokenised stringValue; on a single-token "currentpassword"
    // id, that substring search misses. The scoring engine emits the role via
    // form-context (parent form classifies as account-update), which catches
    // the case legacy misses. This is the engine doing better than legacy —
    // exactly the kind of confidence-bearing improvement the engine exists for.
    //
    // We accept the divergence and assert it stays exactly as-is. A regression
    // (engine stops firing, or fires somewhere new) breaks this assertion.
    const expectedDivergences: Divergence[] = [
      {
        kind: "role",
        opid: "cp",
        role: FieldRole.UpdateCurrentPassword,
        engine: true,
        legacy: false,
      },
      // Engine and legacy both miss the form-category on this fixture: account-update
      // has no shipped FormCategory mapping (engine emits none); legacy maps to
      // AccountCreation because new-password fields are present and there's no
      // spaced "current password" label to flip it to update-aware. Documenting
      // both directions of that miss:
      {
        kind: "category",
        opid: "__form__0",
        category: FormCategory.AccountCreation,
        engine: false,
        legacy: true,
      },
      {
        kind: "formContext",
        opid: "cp",
        category: FormCategory.AccountCreation,
        engine: false,
        legacy: true,
      },
      {
        kind: "formContext",
        opid: "np",
        category: FormCategory.AccountCreation,
        engine: false,
        legacy: true,
      },
      {
        kind: "formContext",
        opid: "cnp",
        category: FormCategory.AccountCreation,
        engine: false,
        legacy: true,
      },
    ];

    it("has the documented divergences and nothing more", () => {
      const divergences = compareEngines(scoring, bridge, fixture);
      expect(sortDivergences(divergences)).toEqual(sortDivergences(expectedDivergences));
    });
  });
});

function compareEngines(
  scoring: ScoringQualificationEngine,
  bridge: LegacyBridgeEngine,
  fixture: Fixture,
): Divergence[] {
  const sPq = scoring.classify(fixture.pageDetails);
  const bPq = bridge.classify(fixture.pageDetails);
  const divergences: Divergence[] = [];

  for (const opid of fixture.fieldOpids) {
    const s = sPq.fieldFor(opid);
    const b = bPq.fieldFor(opid);
    if (s === null || b === null) {
      continue;
    }
    for (const role of scoring.coveredRoles) {
      const engine = s.matchedRoles.has(role);
      const legacy = b.matchedRoles.has(role);
      if (engine !== legacy) {
        divergences.push({ kind: "role", opid, role, engine, legacy });
      }
    }
    for (const category of scoring.coveredCategories) {
      const engine = s.matchedFormContexts.has(category);
      const legacy = b.matchedFormContexts.has(category);
      if (engine !== legacy) {
        divergences.push({ kind: "formContext", opid, category, engine, legacy });
      }
    }
  }

  for (const opid of fixture.formOpids) {
    const s = sPq.formFor(opid);
    const b = bPq.formFor(opid);
    if (s === null || b === null) {
      continue;
    }
    for (const category of scoring.coveredCategories) {
      const engine = s.matchedCategories.has(category);
      const legacy = b.matchedCategories.has(category);
      if (engine !== legacy) {
        divergences.push({ kind: "category", opid, category, engine, legacy });
      }
    }
  }

  return divergences;
}

function sortDivergences(divergences: ReadonlyArray<Divergence>): Divergence[] {
  return [...divergences].sort((a, b) => {
    const aKey = serializeDivergence(a);
    const bKey = serializeDivergence(b);
    return aKey.localeCompare(bKey);
  });
}

function serializeDivergence(d: Divergence): string {
  if (d.kind === "role") {
    return `role:${d.opid}:${d.role}`;
  }
  if (d.kind === "category") {
    return `category:${d.opid}:${d.category}`;
  }
  return `formContext:${d.opid}:${d.category}`;
}

function loginFixture(): Fixture {
  const form = buildForm({ opid: "__form__0", submitButtonText: ["Sign in"] });
  const fields = [
    buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      htmlID: "username",
      htmlName: "username",
      viewable: true,
    }),
    buildField({
      opid: "p",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "current-password",
      htmlID: "password",
      htmlName: "password",
      viewable: true,
    }),
  ];
  return {
    name: "login",
    pageDetails: buildPageDetails({
      fields,
      forms: { __form__0: form },
      url: "https://example.test/login",
      title: "Sign in",
    }),
    fieldOpids: ["u", "p"],
    formOpids: ["__form__0"],
  };
}

function signupFixture(): Fixture {
  const form = buildForm({
    opid: "__form__0",
    htmlAction: "/signup",
    submitButtonText: ["Create account"],
  });
  const fields = [
    buildField({
      opid: "u",
      form: "__form__0",
      elementNumber: 0,
      type: "text",
      autoCompleteType: "username",
      htmlID: "username",
      htmlName: "username",
      viewable: true,
    }),
    buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "newPassword",
      htmlName: "newPassword",
      viewable: true,
    }),
    buildField({
      opid: "cp",
      form: "__form__0",
      elementNumber: 2,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "confirmPassword",
      htmlName: "confirmPassword",
      viewable: true,
    }),
  ];
  return {
    name: "signup",
    pageDetails: buildPageDetails({
      fields,
      forms: { __form__0: form },
      url: "https://example.test/signup",
      title: "Create your account",
    }),
    fieldOpids: ["u", "np", "cp"],
    formOpids: ["__form__0"],
  };
}

function changePasswordFixture(): Fixture {
  const form = buildForm({
    opid: "__form__0",
    submitButtonText: ["Update password"],
  });
  const fields = [
    buildField({
      opid: "cp",
      form: "__form__0",
      elementNumber: 0,
      type: "password",
      autoCompleteType: "current-password",
      htmlID: "currentPassword",
      htmlName: "currentPassword",
      viewable: true,
    }),
    buildField({
      opid: "np",
      form: "__form__0",
      elementNumber: 1,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "newPassword",
      htmlName: "newPassword",
      viewable: true,
    }),
    buildField({
      opid: "cnp",
      form: "__form__0",
      elementNumber: 2,
      type: "password",
      autoCompleteType: "new-password",
      htmlID: "confirmNewPassword",
      htmlName: "confirmNewPassword",
      viewable: true,
    }),
  ];
  return {
    name: "change-password",
    pageDetails: buildPageDetails({
      fields,
      forms: { __form__0: form },
      url: "https://example.test/settings/password",
      title: "Account",
    }),
    fieldOpids: ["cp", "np", "cnp"],
    formOpids: ["__form__0"],
  };
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
  autoCompleteType?: string;
  viewable?: boolean;
}): AutofillField {
  const f = new AutofillField();
  f.opid = args.opid;
  f.elementNumber = args.elementNumber;
  f.viewable = args.viewable ?? true;
  f.htmlID = args.htmlID ?? null;
  f.htmlName = args.htmlName ?? null;
  f.htmlClass = null;
  f.tabindex = null;
  f.title = null;
  f.type = args.type;
  f.placeholder = null;
  f.autoCompleteType = args.autoCompleteType ?? null;
  f.form = args.form;
  return f;
}

// PageQualification re-export is kept available for future direct-engine helpers.
export type { PageQualification };
