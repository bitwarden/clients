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

  beforeEach(() => {
    document.body.innerHTML = "";

    collectService = mock<CollectAutofillContentService>();
    collectService.collectHeuristicPageDetailsBypass.mockResolvedValue(samplePageDetails);

    domQueryService = mock<DomQueryService>();
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

    it("returns fallback with missReason structural when a declared selector resolves but is hidden", async () => {
      const form = document.createElement("form");
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      form.append(hidden);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockReturnValue(hidden);
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
            // Each entry here is a DeepSelectorSequence (string[]); the whole
            // sequence must resolve for the rule to qualify.
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
      // findIframeCrossing returns null for shadow DOM only chains.
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

    it("logs the proceedTargeted outcome with duration and in-scope form count", async () => {
      const form = document.createElement("form");
      const user = document.createElement("input");
      const pass = document.createElement("input");
      form.append(user, pass);
      document.body.append(form);

      domQueryService.queryDeepSelector.mockImplementation((selector) =>
        selector === "#user" ? user : selector === "#pass" ? pass : null,
      );

      await service.qualifyRule("https://example.com", buildLoginRule());

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("proceedTargeted"),
        expect.objectContaining({
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });

    it("logs the structural miss outcome with duration and in-scope form count", async () => {
      domQueryService.queryDeepSelector.mockReturnValue(null);

      await service.qualifyRule("https://example.com", buildLoginRule());

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("structural miss"),
        expect.objectContaining({
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });

    it("logs the in_scope_extras miss outcome with duration and in-scope form count", async () => {
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

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("in_scope_extras miss"),
        expect.objectContaining({
          durationMs: expect.any(Number),
          inScopeForms: expect.any(Number),
        }),
      );
    });
  });
});
