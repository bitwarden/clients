import { mock, MockProxy } from "jest-mock-extended";

import { FormContent, FormPurposeCategory } from "@bitwarden/common/autofill/types";

import AutofillPageDetails from "../models/autofill-page-details";

import { CollectAutofillContentService } from "./abstractions/collect-autofill-content.service";
import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { DomQueryService } from "./abstractions/dom-query.service";
import { DefaultRuleQualificationService } from "./rule-qualification.service";

describe("DefaultRuleQualificationService", () => {
  let collectService: MockProxy<CollectAutofillContentService>;
  let domQueryService: MockProxy<DomQueryService>;
  let domElementVisibilityService: MockProxy<DomElementVisibilityService>;
  let service: DefaultRuleQualificationService;

  const samplePageDetails = {} as AutofillPageDetails;

  const buildLoginRule = (): FormContent[] => [
    {
      category: "login" as FormPurposeCategory,
      fields: {
        username: ["#user"],
        password: ["#pass"],
      },
    },
  ];

  // Mirrors the real `isElementFormFieldElement` filter on the collect service:
  // excludes ignored input types and `data-bwignore` elements.
  const IGNORED_INPUT_TYPES = new Set([
    "hidden",
    "submit",
    "reset",
    "button",
    "image",
    "file",
    "search",
    "url",
    "date",
    "time",
    "datetime",
    "datetime-local",
    "week",
    "color",
    "range",
  ]);
  const realisticIsElementFormFieldElement = (element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    if (element.hasAttribute("data-bwignore")) {
      return false;
    }
    if (tagName === "input") {
      return !IGNORED_INPUT_TYPES.has((element as HTMLInputElement).type);
    }
    return tagName === "textarea" || tagName === "select";
  };

  beforeEach(() => {
    document.body.innerHTML = "";

    collectService = mock<CollectAutofillContentService>();
    collectService.collectHeuristicPageDetailsBypass.mockResolvedValue(samplePageDetails);
    collectService.isElementFormFieldElement.mockImplementation(realisticIsElementFormFieldElement);

    domQueryService = mock<DomQueryService>();
    // Default stub mimics a light-DOM walk of the form root. Tests that need
    // shadow-DOM-rooted or span[data-bwautofill] candidates override this.
    domQueryService.queryWithUnresolvedShadowHosts.mockImplementation((root, predicate) => {
      const elements: Element[] = [];
      (root as Element).querySelectorAll("*").forEach((element) => {
        if (predicate(element)) {
          elements.push(element);
        }
      });
      return { elements: elements as never[], unresolvedHosts: new Set<Element>() };
    });
    domElementVisibilityService = mock<DomElementVisibilityService>();
    domElementVisibilityService.isElementHiddenByCss.mockReturnValue(false);

    service = new DefaultRuleQualificationService(
      collectService,
      domQueryService,
      domElementVisibilityService,
    );
  });

  describe("qualifyRule — happy path", () => {
    it("returns proceedTargeted when every declared selector resolves inside a form with no extras", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      form.append(user, pass);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
      expect(collectService.collectHeuristicPageDetailsBypass).not.toHaveBeenCalled();
    });

    it("returns proceedTargeted when extras exist in unrelated forms outside the in-scope set", async () => {
      const loginForm = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      loginForm.append(user, pass);

      const newsletterForm = document.createElement("form");
      const email = document.createElement("input");
      newsletterForm.append(email);

      document.body.append(loginForm, newsletterForm);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });
  });

  describe("qualifyRule — structural miss", () => {
    it("returns fallback with missReason structural when a declared selector does not resolve", async () => {
      domQueryService.queryDeepSelector.mockReturnValue(null);

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({
        kind: "fallback",
        missReason: "structural",
        pageDetails: samplePageDetails,
      });
      expect(collectService.collectHeuristicPageDetailsBypass).toHaveBeenCalledWith();
    });

    it("returns fallback with missReason structural when a declared selector resolves to an input[type=hidden]", async () => {
      // Exercises the real `type="hidden"` check in Half 1. The visibility
      // service's `isElementHiddenByCss` only inspects CSS, so a hidden-type
      // input would silently qualify without the dedicated check.
      const form = document.createElement("form");
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      form.append(hidden);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockReturnValue(hidden);

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({
        kind: "fallback",
        missReason: "structural",
        pageDetails: samplePageDetails,
      });
    });

    it("returns fallback with missReason structural when a declared selector resolves but is CSS-hidden", async () => {
      const form = document.createElement("form");
      const field = document.createElement("input");
      form.append(field);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockReturnValue(field);
      domElementVisibilityService.isElementHiddenByCss.mockReturnValue(true);

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({
        kind: "fallback",
        missReason: "structural",
        pageDetails: samplePageDetails,
      });
    });

    it("fails structural when any member of a DeepSelectorSequence does not resolve", async () => {
      const form = document.createElement("form");
      const d1 = document.createElement("input");
      const d2 = document.createElement("input");
      form.append(d1, d2);
      document.body.append(form);

      const otpRule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: {
            // Each entry here is a DeepSelectorSequence (string[]). The whole sequence
            // must resolve for the rule to qualify.
            oneTimeCode: [["#d1", "#d2", "#d3-missing"]],
          },
        },
      ];

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#d1" ? d1 : selector === "#d2" ? d2 : null,
      );

      const result = await service.qualifyRule("https://example.com", otpRule);

      expect(result).toMatchObject({ kind: "fallback", missReason: "structural" });
    });
  });

  describe("qualifyRule — selector alternatives", () => {
    const buildAlternativesRule = (): FormContent[] => [
      {
        category: "login" as FormPurposeCategory,
        fields: {
          username: ["#email", "#login"],
          password: ["#pwd"],
        },
      },
    ];

    it("qualifies when only the first alternative resolves", async () => {
      const form = document.createElement("form");
      const email = document.createElement("input");
      const pwd = document.createElement("input");
      form.append(email, pwd);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#email" ? email : selector === "#pwd" ? pwd : null,
      );

      const result = await service.qualifyRule("https://example.com", buildAlternativesRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });

    it("qualifies when only the second alternative resolves", async () => {
      const form = document.createElement("form");
      const login = document.createElement("input");
      const pwd = document.createElement("input");
      form.append(login, pwd);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#login" ? login : selector === "#pwd" ? pwd : null,
      );

      const result = await service.qualifyRule("https://example.com", buildAlternativesRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });

    it("fails structural when no alternative resolves", async () => {
      const form = document.createElement("form");
      const pwd = document.createElement("input");
      form.append(pwd);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#pwd" ? pwd : null,
      );

      const result = await service.qualifyRule("https://example.com", buildAlternativesRule());

      expect(result).toMatchObject({ kind: "fallback", missReason: "structural" });
    });

    it("qualifies when a sequence alternative fully resolves even though the string alternative does not", async () => {
      // Rule: `password: ["#pwd", ["#pwd-a", "#pwd-b"]]`.
      // Page has `#pwd-a` and `#pwd-b` but not `#pwd`.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pwdA = document.createElement("input");
      const pwdB = document.createElement("input");
      form.append(user, pwdA, pwdB);
      document.body.append(form);

      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: {
            username: ["#user"],
            password: ["#pwd", ["#pwd-a", "#pwd-b"]],
          },
        },
      ];

      domQueryService.queryDeepSelector.mockImplementation((selector) => {
        if (selector === "#user") {
          return user;
        }
        if (selector === "#pwd-a") {
          return pwdA;
        }
        if (selector === "#pwd-b") {
          return pwdB;
        }
        return null;
      });

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toEqual({ kind: "proceedTargeted" });
    });

    it("fails structural when a sequence alternative has one member missing and no other alternative qualifies", async () => {
      const form = document.createElement("form");
      const d1 = document.createElement("input");
      const d2 = document.createElement("input");
      form.append(d1, d2);
      document.body.append(form);

      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: {
            oneTimeCode: [["#d1", "#d2", "#d3-missing"]],
          },
        },
      ];

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#d1" ? d1 : selector === "#d2" ? d2 : null,
      );

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toMatchObject({ kind: "fallback", missReason: "structural" });
    });

    it("treats every alternative's resolved elements as declared for the extras check", async () => {
      // Both `#email` and `#login` are declared as alternatives for the
      // username and both exist on the page. Neither should be flagged as an
      // extra. A third input that no alternative covers should.
      const form = document.createElement("form");
      const email = document.createElement("input");
      const login = document.createElement("input");
      const pwd = document.createElement("input");
      const stray = document.createElement("input");
      form.append(email, login, pwd, stray);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) => {
        if (selector === "#email") {
          return email;
        }
        if (selector === "#login") {
          return login;
        }
        if (selector === "#pwd") {
          return pwd;
        }
        return null;
      });

      const result = await service.qualifyRule("https://example.com", buildAlternativesRule());

      expect(result).toMatchObject({ kind: "fallback", missReason: "in_scope_extras" });
    });

    it("qualifies when only one of several container selectors resolves", async () => {
      // Container entries name the same element with different selectors.
      // Any one resolving is enough. Pins the any-of semantic for container.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      form.append(user, pass);
      document.body.append(form);

      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          container: ["#main-login", "#legacy-login"],
          fields: {
            username: ["#user"],
            password: ["#pass"],
          },
        },
      ];

      domQueryService.queryDeepSelector.mockImplementation((selector) => {
        if (selector === "#legacy-login") {
          return form;
        }
        if (selector === "#user") {
          return user;
        }
        if (selector === "#pass") {
          return pass;
        }
        return null;
      });

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toEqual({ kind: "proceedTargeted" });
    });
  });

  describe("qualifyRule — in-scope extras miss", () => {
    it("returns fallback with missReason in_scope_extras when an in-scope form contains an undeclared field", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      const extra = document.createElement("input");
      form.append(user, pass, extra);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({
        kind: "fallback",
        missReason: "in_scope_extras",
        pageDetails: samplePageDetails,
      });
    });

    it("passes the in-scope detection to the bypass when extras are found", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      const extra = document.createElement("input");
      form.append(user, pass, extra);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      await service.qualifyRule("https://example.com", buildLoginRule());

      expect(collectService.collectHeuristicPageDetailsBypass).toHaveBeenCalledWith(
        expect.objectContaining({
          forms: expect.any(Set),
          detectedFields: expect.any(Map),
        }),
      );
    });

    it("flags a shadow-DOM-rooted field inside an in-scope form as in_scope_extras", async () => {
      // Regression guard. The extras check must cross shadow boundaries, or a
      // shadow-rooted field inside an in-scope form would be invisible and the
      // rule would qualify despite the extra.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const customEl = document.createElement("my-input");
      form.append(user, customEl);
      document.body.append(form);

      // Stand-in for a field inside customEl's shadow root. The test only
      // exercises what the deep-query mock returns, not the live DOM.
      const shadowPassword = document.createElement("input");
      shadowPassword.type = "password";

      const usernameOnlyRule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: { username: ["#user"] },
        },
      ];

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : null,
      );
      domQueryService.queryWithUnresolvedShadowHosts.mockImplementation((root, predicate) => {
        if (root === form) {
          return {
            elements: [user, shadowPassword] as never[],
            unresolvedHosts: new Set<Element>(),
          };
        }
        const elements: Element[] = [];
        (root as Element).querySelectorAll("*").forEach((element) => {
          if (predicate(element)) {
            elements.push(element);
          }
        });
        return { elements: elements as never[], unresolvedHosts: new Set<Element>() };
      });

      const result = await service.qualifyRule("https://example.com", usernameOnlyRule);

      expect(result).toMatchObject({ kind: "fallback", missReason: "in_scope_extras" });
    });

    it("flags a span[data-bwautofill] inside an in-scope form as in_scope_extras", async () => {
      // When honorBitwardenAutofillAttribute is on, the heuristic treats
      // span[data-bwautofill] as a fillable field. An undeclared one inside
      // an in-scope form must be flagged as an extra.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      pass.type = "password";
      const span = document.createElement("span");
      span.setAttribute("data-bwautofill", "");
      form.append(user, pass, span);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );
      collectService.isElementFormFieldElement.mockImplementation((element) => {
        if (element.tagName.toLowerCase() === "span" && element.hasAttribute("data-bwautofill")) {
          return true;
        }
        return realisticIsElementFormFieldElement(element);
      });

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toMatchObject({ kind: "fallback", missReason: "in_scope_extras" });
    });

    it("qualifies a realistic login form containing a submit button and hidden token", async () => {
      // Regression guard. Earlier the detector used a coarse filter that counted
      // every input/select/textarea as a fillable field, so a standard login
      // form with a CSRF hidden input and a submit button failed Half 2 on
      // every page load. The real heuristic filter excludes those types.
      const form = document.createElement("form");
      const user = document.createElement("input");
      user.id = "user";
      const pass = document.createElement("input");
      pass.id = "pass";
      pass.type = "password";
      const csrf = document.createElement("input");
      csrf.type = "hidden";
      csrf.name = "csrf_token";
      const submit = document.createElement("input");
      submit.type = "submit";
      form.append(user, pass, csrf, submit);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });

    it("qualifies a login form with a Remember Me checkbox", async () => {
      // Checkbox and radio are not rule types and the autofill engine does
      // not fill them, so Half 2 must not flag them as extras.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      pass.type = "password";
      const remember = document.createElement("input");
      remember.type = "checkbox";
      form.append(user, pass, remember);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });

    it("ignores a CSS-hidden input when checking for extras", async () => {
      // Honeypot inputs are rendered off-screen or display:none. Treating
      // them as extras would cause misses on forms that use them.
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      pass.type = "password";
      const honeypot = document.createElement("input");
      form.append(user, pass, honeypot);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );
      domElementVisibilityService.isElementHiddenByCss.mockImplementation(
        (element) => element === honeypot,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });
  });

  describe("qualifyRule — formless pages (known limitation)", () => {
    it("returns proceedTargeted when every selector resolves outside any form, even if page has other fields", async () => {
      // Fields rendered as plain divs, not inside <form>. closest("form") returns
      // null for the resolved elements, so the in-scope form set is empty and
      // the extras check passes without inspecting the page's other fields.
      const user = document.createElement("input");
      const pass = document.createElement("input");
      const unrelated = document.createElement("input");
      document.body.append(user, pass, unrelated);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      const result = await service.qualifyRule("https://example.com", buildLoginRule());

      expect(result).toEqual({ kind: "proceedTargeted" });
    });
  });

  describe("qualifyRule — iframe >>> selectors", () => {
    it("passes structural when the first-hop iframe exists in the parent's DOM", async () => {
      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: { username: ["iframe#login >>> #user"] },
        },
      ];
      const iframe = document.createElement("iframe");
      domQueryService.findIframeCrossing.mockReturnValue({
        iframeElement: iframe,
        innerSelector: "#user",
      });

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toEqual({ kind: "proceedTargeted" });
      expect(domQueryService.queryDeepSelector).not.toHaveBeenCalled();
    });

    it("fails structural when the first-hop iframe is missing (findIframeCrossing returns null)", async () => {
      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: { username: ["iframe#missing >>> #user"] },
        },
      ];
      domQueryService.findIframeCrossing.mockReturnValue(null);
      domQueryService.queryDeepSelector.mockReturnValue(null);

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toMatchObject({ kind: "fallback", missReason: "structural" });
    });
  });

  describe("qualifyRule — shadow DOM >>> selectors", () => {
    it("passes structural when a shadow DOM >>> chain resolves to an eligible element", async () => {
      const rule: FormContent[] = [
        {
          category: "login" as FormPurposeCategory,
          fields: { username: ["gi-login.hydrated >>> input#user"] },
        },
      ];
      const input = document.createElement("input");
      // findIframeCrossing returns null for chains without an iframe boundary.
      domQueryService.findIframeCrossing.mockReturnValue(null);
      domQueryService.queryDeepSelector.mockReturnValue(input);

      const result = await service.qualifyRule("https://example.com", rule);

      expect(result).toEqual({ kind: "proceedTargeted" });
    });
  });

  describe("qualifyRule — debug logging", () => {
    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
      debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
      debugSpy.mockRestore();
    });

    it("logs the proceedTargeted outcome with domain, duration, and in-scope form count", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      form.append(user, pass);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      await service.qualifyRule("https://example.com/login?token=secret", buildLoginRule());

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("proceedTargeted"),
        expect.objectContaining({
          domain: "example.com",
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });

    it("logs the structural miss outcome with domain, duration, and in-scope form count", async () => {
      domQueryService.queryDeepSelector.mockReturnValue(null);

      await service.qualifyRule("https://example.com/login?token=secret", buildLoginRule());

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("structural miss"),
        expect.objectContaining({
          domain: "example.com",
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });

    it("logs the in_scope_extras miss outcome with domain, duration, and in-scope form count", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      const extra = document.createElement("input");
      form.append(user, pass, extra);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      await service.qualifyRule("https://example.com/login?token=secret", buildLoginRule());

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("in_scope_extras miss"),
        expect.objectContaining({
          domain: "example.com",
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });
  });
});
