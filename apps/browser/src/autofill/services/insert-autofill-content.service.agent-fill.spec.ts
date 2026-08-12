import { mock, MockProxy } from "jest-mock-extended";

import { mockQuerySelectorAllDefinedCall } from "../spec/testing-utils";
import { ElementWithOpId, FormFieldElement } from "../types";
import { AgentFillOp } from "../types/agent-fill";

import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { CollectAutofillContentService } from "./collect-autofill-content.service";
import { DomQueryService } from "./dom-query.service";
import InsertAutofillContentService from "./insert-autofill-content.service";

describe("InsertAutofillContentService agent fill", () => {
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();
  const expectedOrigin = globalThis.location.origin;
  let domElementVisibilityService: MockProxy<DomElementVisibilityService>;
  let collectAutofillContentService: CollectAutofillContentService;
  let insertAutofillContentService: InsertAutofillContentService;

  function setPageContent(html: string) {
    document.body.innerHTML = html;
  }

  function tagElementWithOpid(selector: string, opid: string): HTMLInputElement {
    const element = document.querySelector<HTMLInputElement>(selector)!;
    (element as unknown as ElementWithOpId<FormFieldElement>).opid = opid;
    return element;
  }

  function passwordOp(customFields: Partial<AgentFillOp> = {}): AgentFillOp {
    return { opid: "__pw", role: "password", value: "hunter2-secret", ...customFields };
  }

  beforeEach(() => {
    domElementVisibilityService = mock<DomElementVisibilityService>();
    domElementVisibilityService.isElementViewable.mockResolvedValue(true);
    domElementVisibilityService.isElementHiddenByCss.mockReturnValue(false);
    collectAutofillContentService = new CollectAutofillContentService(
      domElementVisibilityService,
      new DomQueryService(),
    );
    insertAutofillContentService = new InsertAutofillContentService(
      domElementVisibilityService,
      collectAutofillContentService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  describe("the absolute password rule (§4.1)", () => {
    it("fills a password op into an input[type=password]", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      const element = tagElementWithOpid("#pw", "__pw");
      const inputEvents: string[] = [];
      element.addEventListener("input", () => inputEvents.push("input"));
      element.addEventListener("change", () => inputEvents.push("change"));

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp()],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__pw", status: "filled" }]);
      expect(element.value).toBe("hunter2-secret");
      expect(inputEvents).toEqual(["input", "change"]);
    });

    it("refuses to write a password into a text input named 'password'", async () => {
      setPageContent(`<form><input type="text" name="password" id="pw-text" /></form>`);
      const element = tagElementWithOpid("#pw-text", "__pw");

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp()],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__pw", status: "failed", reason: "not-password-input" }]);
      expect(element.value).toBe("");
    });

    it("refuses to write a non-password role into a password input", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      const element = tagElementWithOpid("#pw", "__user");

      const results = await insertAutofillContentService.fillAgentFields(
        [{ opid: "__user", role: "username", value: "user@example.com" }],
        expectedOrigin,
      );

      expect(results).toEqual([
        { opid: "__user", status: "failed", reason: "role-forbidden-for-password-input" },
      ]);
      expect(element.value).toBe("");
    });
  });

  describe("write-time element checks", () => {
    it("fills a username op into a text input", async () => {
      setPageContent(`<form><input type="email" id="email" /></form>`);
      const element = tagElementWithOpid("#email", "__user");

      const results = await insertAutofillContentService.fillAgentFields(
        [{ opid: "__user", role: "username", value: "user@example.com" }],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__user", status: "filled" }]);
      expect(element.value).toBe("user@example.com");
    });

    it("fails when the element is not viewable at write time", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      const element = tagElementWithOpid("#pw", "__pw");
      domElementVisibilityService.isElementViewable.mockResolvedValue(false);

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp()],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__pw", status: "failed", reason: "not-viewable" }]);
      expect(element.value).toBe("");
    });

    it("fails when the element is readonly or disabled", async () => {
      setPageContent(
        `<form>
          <input type="password" id="pw-readonly" readonly />
          <input type="password" id="pw-disabled" disabled />
        </form>`,
      );
      tagElementWithOpid("#pw-readonly", "__pw-readonly");
      tagElementWithOpid("#pw-disabled", "__pw-disabled");

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp({ opid: "__pw-readonly" }), passwordOp({ opid: "__pw-disabled" })],
        expectedOrigin,
      );

      expect(results).toEqual([
        { opid: "__pw-readonly", status: "failed", reason: "readonly-or-disabled" },
        { opid: "__pw-disabled", status: "failed", reason: "readonly-or-disabled" },
      ]);
    });

    it("fails when no element resolves for the opid", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      tagElementWithOpid("#pw", "__pw");

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp({ opid: "__no-such-opid" })],
        expectedOrigin,
      );

      expect(results).toEqual([
        { opid: "__no-such-opid", status: "failed", reason: "element-not-found" },
      ]);
    });

    it("never falls back to an index-guessed element for an unknown opid", async () => {
      // getAutofillFieldElementByOpid guesses formFieldElements[N] for unknown opids "__N";
      // that guess must never receive a credential.
      setPageContent(
        `<form><input type="text" id="first" /><input type="password" id="second" /></form>`,
      );
      tagElementWithOpid("#first", "__0");
      const guessTarget = document.querySelector<HTMLInputElement>("#second")!;

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp({ opid: "__1" })],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__1", status: "failed", reason: "element-not-found" }]);
      expect(guessTarget.value).toBe("");
    });
  });

  describe("frame-level checks", () => {
    it("fails every op when the document origin does not match the expected origin", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      const element = tagElementWithOpid("#pw", "__pw");

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp(), { opid: "__user", role: "username", value: "user@example.com" }],
        "https://a-different-origin.example.org",
      );

      expect(results).toEqual([
        { opid: "__pw", status: "failed", reason: "origin-mismatch" },
        { opid: "__user", status: "failed", reason: "origin-mismatch" },
      ]);
      expect(element.value).toBe("");
    });

    it("fails every op when no expected origin is provided", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      tagElementWithOpid("#pw", "__pw");

      const results = await insertAutofillContentService.fillAgentFields([passwordOp()], "");

      expect(results).toEqual([{ opid: "__pw", status: "failed", reason: "origin-mismatch" }]);
    });

    it("fails every op inside a sandboxed iframe", async () => {
      setPageContent(`<form><input type="password" id="pw" /></form>`);
      const element = tagElementWithOpid("#pw", "__pw");
      Object.defineProperty(globalThis, "frameElement", {
        value: { getAttribute: jest.fn(() => "") },
        writable: true,
        configurable: true,
      });

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp()],
        expectedOrigin,
      );

      expect(results).toEqual([{ opid: "__pw", status: "failed", reason: "sandboxed-iframe" }]);
      expect(element.value).toBe("");

      Object.defineProperty(globalThis, "frameElement", {
        value: null,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("value hygiene", () => {
    it("never echoes the credential value in results", async () => {
      setPageContent(
        `<form><input type="password" id="pw" /><input type="text" id="pw-text" /></form>`,
      );
      tagElementWithOpid("#pw", "__pw");
      tagElementWithOpid("#pw-text", "__pw-text");

      const results = await insertAutofillContentService.fillAgentFields(
        [passwordOp(), passwordOp({ opid: "__pw-text" })],
        expectedOrigin,
      );

      expect(JSON.stringify(results)).not.toContain("hunter2-secret");
    });
  });
});
