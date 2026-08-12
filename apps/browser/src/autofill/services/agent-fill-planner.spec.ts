import AutofillField from "../models/autofill-field";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createPageDetailMock,
} from "../spec/autofill-mocks";

import { PageDetail } from "./abstractions/autofill.service";
import { AgentFillPlanner, buildAgentFillFieldSignature, originOf } from "./agent-fill-planner";
import { InlineMenuFieldQualificationService } from "./inline-menu-field-qualification.service";

const TAB_URL = "https://example.com/login";
const TAB_ORIGIN = "https://example.com";

function field(customFields: Partial<AutofillField> = {}): AutofillField {
  return createAutofillFieldMock({
    autoCompleteType: "off",
    htmlID: "",
    htmlName: "",
    placeholder: "",
    "label-left": "",
    "label-right": "",
    "label-top": "",
    "label-tag": "",
    "label-aria": "",
    title: "",
    form: "loginForm",
    ...customFields,
  });
}

function pageDetail(fields: AutofillField[], customFields: Partial<PageDetail> = {}): PageDetail {
  return createPageDetailMock({
    frameId: 0,
    tab: createChromeTabMock({ url: TAB_URL }),
    details: createAutofillPageDetailsMock({
      url: TAB_URL,
      forms: {
        loginForm: {
          opid: "loginForm",
          htmlName: "",
          htmlID: "",
          htmlAction: "",
          htmlMethod: "post",
          htmlClass: "",
          htmlAncestorHeadings: [],
        },
      },
      fields,
    }),
    ...customFields,
  });
}

function usernameField(customFields: Partial<AutofillField> = {}): AutofillField {
  return field({ opid: "__0", htmlID: "email", type: "text", ...customFields });
}

function passwordField(customFields: Partial<AutofillField> = {}): AutofillField {
  return field({ opid: "__1", htmlID: "pw", type: "password", ...customFields });
}

describe("AgentFillPlanner", () => {
  let planner: AgentFillPlanner;
  const tab = createChromeTabMock({ url: TAB_URL });

  beforeEach(() => {
    planner = new AgentFillPlanner(new InlineMenuFieldQualificationService());
  });

  describe("happy path — one login form with one username and one password field", () => {
    it("plans both roles and classifies the page as login", () => {
      const plan = planner.plan([pageDetail([usernameField(), passwordField()])], tab);

      expect(plan.formClass).toBe("login");
      expect(plan.origin).toBe(TAB_ORIGIN);
      expect(plan.refusals).toEqual([]);
      expect(plan.selections.username?.opid).toBe("__0");
      expect(plan.selections.password?.opid).toBe("__1");
      expect(plan.candidates).toEqual([
        expect.objectContaining({ role: "username", frame: "top", visible: true }),
        expect.objectContaining({
          role: "password",
          target: "input[type=password]#pw (login form)",
          frame: "top",
          visible: true,
        }),
      ]);
    });

    it("never copies field values into the plan", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField({ value: "secret-value" }),
            passwordField({ value: "hunter2" }),
          ]),
        ],
        tab,
      );

      expect(JSON.stringify(plan)).not.toContain("secret-value");
      expect(JSON.stringify(plan)).not.toContain("hunter2");
    });
  });

  describe("registration forms are refused (§4.1)", () => {
    it("refuses a form with a password and a confirm-password field", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField(),
            passwordField(),
            passwordField({ opid: "__2", htmlID: "confirm-pw" }),
          ]),
        ],
        tab,
      );

      expect(plan.formClass).toBe("registration");
      expect(plan.selections.password).toBeUndefined();
      expect(plan.refusals).toContainEqual({ role: "password", reason: "looks-like-registration" });
      expect(plan.pageRefusal).toBe("looks-like-registration");
    });

    it("refuses a single password field marked autocomplete new-password", () => {
      const plan = planner.plan(
        [pageDetail([usernameField(), passwordField({ autoCompleteType: "new-password" })])],
        tab,
      );

      expect(plan.formClass).toBe("registration");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "looks-like-registration" });
    });

    it("refuses a password field whose form identifiers carry registration keywords", () => {
      const detail = pageDetail([usernameField(), passwordField()]);
      detail.details.forms["loginForm"].htmlID = "signup-form";

      const plan = planner.plan([detail], tab);

      expect(plan.formClass).toBe("registration");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "looks-like-registration" });
    });
  });

  describe("hidden fields are never candidates (§4.1)", () => {
    it("refuses a page whose only password field is not viewable (honeypot)", () => {
      const plan = planner.plan([pageDetail([passwordField({ viewable: false })])], tab);

      expect(plan.formClass).toBe("none");
      expect(plan.selections.password).toBeUndefined();
      expect(plan.refusals).toContainEqual({ role: "password", reason: "hidden-field-only" });
    });

    it("refuses a page whose only password field is aria-hidden", () => {
      const plan = planner.plan([pageDetail([passwordField({ "aria-hidden": true })])], tab);

      expect(plan.formClass).toBe("none");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "hidden-field-only" });
    });
  });

  describe("the absolute password rule — input[type=password] only (§4.1)", () => {
    it("never treats a text input named 'password' as a password target", () => {
      const plan = planner.plan(
        [pageDetail([field({ opid: "__0", type: "text", htmlName: "password" })])],
        tab,
      );

      expect(plan.selections.password).toBeUndefined();
      expect(plan.selections.username).toBeUndefined();
      expect(plan.formClass).toBe("none");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "no-password-field" });
    });

    it("never selects a password-type field for the totp role", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField(),
            passwordField(),
            field({ opid: "__2", type: "password", htmlID: "totp-code", maxLength: 6 }),
          ]),
        ],
        tab,
      );

      // The second password field makes this a registration-shaped form; either way the
      // password-typed totp-named input must never become a totp candidate.
      expect(plan.selections.totp).toBeUndefined();
    });
  });

  describe("ambiguity is a refusal, never a guess (§4.1)", () => {
    it("refuses when two candidate login forms exist", () => {
      const detail = pageDetail([
        usernameField({ form: "loginForm" }),
        passwordField({ form: "loginForm" }),
        usernameField({ opid: "__2", htmlID: "email2", form: "otherForm" }),
        passwordField({ opid: "__3", htmlID: "pw2", form: "otherForm" }),
      ]);
      detail.details.forms["otherForm"] = {
        ...detail.details.forms["loginForm"],
        opid: "otherForm",
      };

      const plan = planner.plan([detail], tab);

      expect(plan.formClass).toBe("ambiguous");
      expect(plan.selections.password).toBeUndefined();
      expect(plan.refusals).toContainEqual({ role: "password", reason: "ambiguous-target" });
    });

    it("refuses the username role when two equally-qualified username fields exist", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField(),
            usernameField({ opid: "__2", htmlID: "email-alt" }),
            passwordField({ opid: "__3" }),
          ]),
        ],
        tab,
      );

      expect(plan.formClass).toBe("login");
      expect(plan.selections.password?.opid).toBe("__3");
      expect(plan.selections.username).toBeUndefined();
      expect(plan.refusals).toContainEqual({ role: "username", reason: "ambiguous-target" });
    });

    it("prefers the explicit autocomplete username field over bare text inputs", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField({ htmlID: "other-text" }),
            usernameField({ opid: "__2", htmlID: "email", autoCompleteType: "username" }),
            passwordField({ opid: "__3" }),
          ]),
        ],
        tab,
      );

      expect(plan.selections.username?.opid).toBe("__2");
      expect(plan.refusals).toEqual([]);
    });
  });

  describe("multi-step logins", () => {
    it("classifies a lone autocomplete=username input with no password field as multi-step-username", () => {
      const plan = planner.plan(
        [pageDetail([usernameField({ autoCompleteType: "username", form: null })])],
        tab,
      );

      expect(plan.formClass).toBe("multi-step-username");
      expect(plan.selections.username?.opid).toBe("__0");
      expect(plan.selections.password).toBeUndefined();
    });

    it("classifies a page with exactly one plain email input as multi-step-username", () => {
      const plan = planner.plan([pageDetail([usernameField({ type: "email", form: null })])], tab);

      expect(plan.formClass).toBe("multi-step-username");
      expect(plan.selections.username?.opid).toBe("__0");
    });

    it("classifies a password field without any username field as multi-step-password", () => {
      const plan = planner.plan([pageDetail([passwordField()])], tab);

      expect(plan.formClass).toBe("multi-step-password");
      expect(plan.selections.password?.opid).toBe("__1");
      expect(plan.selections.username).toBeUndefined();
    });
  });

  describe("totp", () => {
    it("plans a lone one-time-code input on a page without a login form", () => {
      const plan = planner.plan(
        [
          pageDetail([
            field({ opid: "__0", type: "text", autoCompleteType: "one-time-code", form: null }),
          ]),
        ],
        tab,
      );

      expect(plan.formClass).toBe("none");
      expect(plan.selections.totp?.opid).toBe("__0");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "no-password-field" });
    });

    it("plans a totp field alongside username and password in the same form", () => {
      const plan = planner.plan(
        [
          pageDetail([
            usernameField(),
            passwordField(),
            field({ opid: "__2", type: "text", htmlID: "totpcode", maxLength: 6 }),
          ]),
        ],
        tab,
      );

      expect(plan.formClass).toBe("login");
      expect(plan.selections.totp?.opid).toBe("__2");
    });
  });

  describe("origin binding — cross-origin frames are excluded (§3, §4.1)", () => {
    it("never considers fields in a frame whose origin differs from the tab origin", () => {
      const crossOriginDetail = pageDetail([usernameField(), passwordField()], { frameId: 1 });
      crossOriginDetail.details.url = "https://evil.example.org/embed";

      const plan = planner.plan([pageDetail([]), crossOriginDetail], tab);

      expect(plan.selections.password).toBeUndefined();
      expect(plan.selections.username).toBeUndefined();
      expect(plan.formClass).toBe("none");
      expect(plan.refusals).toContainEqual({ role: "password", reason: "cross-origin-frame" });
    });

    it("labels a same-origin iframe with the frame origin rather than 'top'", () => {
      const frameDetail = pageDetail([usernameField(), passwordField()], { frameId: 7 });

      const plan = planner.plan([frameDetail], tab);

      expect(plan.selections.password?.frame).toBe(TAB_ORIGIN);
      expect(plan.selections.password?.frameId).toBe(7);
    });
  });

  describe("empty and unusable pages", () => {
    it("refuses a page with no fields at all", () => {
      const plan = planner.plan([pageDetail([])], tab);

      expect(plan.formClass).toBe("none");
      expect(plan.candidates).toEqual([]);
      expect(plan.pageRefusal).toBe("no-login-form");
    });

    it("refuses when the tab url has no parseable origin", () => {
      const plan = planner.plan(
        [pageDetail([usernameField(), passwordField()])],
        createChromeTabMock({ url: undefined }),
      );

      expect(plan.candidates).toEqual([]);
      expect(plan.pageRefusal).toBe("no-login-form");
    });
  });

  describe("signatures", () => {
    it("builds a deterministic signature from element identity, excluding values", () => {
      const target = passwordField({ value: "hunter2" });
      const signature = buildAgentFillFieldSignature(target, 0);

      expect(signature).toBe(buildAgentFillFieldSignature(passwordField({ value: "other" }), 0));
      expect(signature).not.toContain("hunter2");
      expect(signature).not.toBe(buildAgentFillFieldSignature(target, 1));
      expect(signature).not.toBe(
        buildAgentFillFieldSignature(passwordField({ htmlID: "changed" }), 0),
      );
    });
  });

  describe("originOf", () => {
    it("parses origins and rejects unparseable or opaque urls", () => {
      expect(originOf("https://example.com/a/b?c=d")).toBe("https://example.com");
      expect(originOf("not a url")).toBeNull();
      expect(originOf(undefined)).toBeNull();
      expect(originOf("")).toBeNull();
      expect(originOf("about:blank")).toBeNull();
    });
  });
});
