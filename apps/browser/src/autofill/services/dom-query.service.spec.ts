import { flushPromises, mockQuerySelectorAllDefinedCall } from "../spec/testing-utils";

import { DomQueryService } from "./dom-query.service";

jest.mock("../utils", () => {
  const actualUtils = jest.requireActual("../utils");
  return {
    ...actualUtils,
    sendExtensionMessage: jest.fn((command, options) => {
      return chrome.runtime.sendMessage(Object.assign({ command }, options));
    }),
  };
});

describe("DomQueryService", () => {
  const originalDocumentReadyState = document.readyState;
  let domQueryService: DomQueryService;
  let mutationObserver: MutationObserver;
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();

  beforeEach(async () => {
    mutationObserver = new MutationObserver(() => {});
    domQueryService = new DomQueryService();
    await flushPromises();
  });

  afterEach(() => {
    Object.defineProperty(document, "readyState", {
      value: originalDocumentReadyState,
      writable: true,
    });
  });

  afterAll(() => {
    mockQuerySelectorAll.mockRestore();
  });

  it("checks the page content for shadow DOM elements after the page has completed loading", async () => {
    Object.defineProperty(document, "readyState", {
      value: "loading",
      writable: true,
    });
    jest.spyOn(globalThis, "addEventListener");

    const domQueryService = new DomQueryService();
    await flushPromises();

    expect(globalThis.addEventListener).toHaveBeenCalledWith(
      "load",
      domQueryService["updatePageContainsShadowDom"],
    );
  });

  describe("deepQueryElements", () => {
    it("queries form field elements that are nested within a ShadowDOM", () => {
      const root = document.createElement("div");
      const shadowRoot = root.attachShadow({ mode: "open" });
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.type = "text";
      form.appendChild(input);
      shadowRoot.appendChild(form);

      const formFieldElements = domQueryService.query(
        shadowRoot,
        "input",
        (element: Element) => element.tagName === "INPUT",
        mutationObserver,
      );

      expect(formFieldElements).toStrictEqual([input]);
    });

    it("queries form field elements that are nested within multiple ShadowDOM elements", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const root = document.createElement("div");
      const shadowRoot1 = root.attachShadow({ mode: "open" });
      const root2 = document.createElement("div");
      const shadowRoot2 = root2.attachShadow({ mode: "open" });
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.type = "text";
      form.appendChild(input);
      shadowRoot2.appendChild(form);
      shadowRoot1.appendChild(root2);

      const formFieldElements = domQueryService.query(
        shadowRoot1,
        "input",
        (element: Element) => element.tagName === "INPUT",
        mutationObserver,
      );

      expect(formFieldElements).toStrictEqual([input]);
    });

    it("will fallback to using the TreeWalker API if a depth larger than 4 ShadowDOM elements is encountered", () => {
      const root = document.createElement("div");
      const shadowRoot1 = root.attachShadow({ mode: "open" });
      const root2 = document.createElement("div");
      const shadowRoot2 = root2.attachShadow({ mode: "open" });
      const root3 = document.createElement("div");
      const shadowRoot3 = root3.attachShadow({ mode: "open" });
      const root4 = document.createElement("div");
      const shadowRoot4 = root4.attachShadow({ mode: "open" });
      const root5 = document.createElement("div");
      const shadowRoot5 = root5.attachShadow({ mode: "open" });
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.type = "text";
      form.appendChild(input);
      shadowRoot5.appendChild(form);
      shadowRoot4.appendChild(root5);
      shadowRoot3.appendChild(root4);
      shadowRoot2.appendChild(root3);
      shadowRoot1.appendChild(root2);
      const treeWalkerCallback = jest
        .fn()
        .mockImplementation(() => (element: Element) => element.tagName === "INPUT");

      domQueryService.query(shadowRoot1, "input", treeWalkerCallback, mutationObserver);

      expect(treeWalkerCallback).toHaveBeenCalled();
    });
  });

  describe("queryAllTreeWalkerNodes", () => {
    it("queries form field elements that are nested within multiple ShadowDOM elements", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const root = document.createElement("div");
      const shadowRoot1 = root.attachShadow({ mode: "open" });
      const root2 = document.createElement("div");
      const shadowRoot2 = root2.attachShadow({ mode: "open" });
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.type = "text";
      form.appendChild(input);
      shadowRoot2.appendChild(form);
      shadowRoot1.appendChild(root2);

      const formFieldElements = domQueryService.query(
        shadowRoot1,
        "input",
        (element: Element) => element.tagName === "INPUT",
        mutationObserver,
      );

      expect(formFieldElements).toStrictEqual([input]);
    });
  });

  describe("checkMutationsInShadowRoots", () => {
    it("returns true when a mutation occurred within a shadow root", () => {
      const customElement = document.createElement("custom-element");
      const shadowRoot = customElement.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      shadowRoot.appendChild(input);

      const mutationRecord: MutationRecord = {
        type: "childList",
        addedNodes: NodeList.prototype,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: NodeList.prototype,
        target: input,
      };

      const result = domQueryService.checkMutationsInShadowRoots([mutationRecord]);

      expect(result).toBe(true);
    });

    it("returns false when mutations occurred in the light DOM", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const mutationRecord: MutationRecord = {
        type: "childList",
        addedNodes: NodeList.prototype,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: NodeList.prototype,
        target: div,
      };

      const result = domQueryService.checkMutationsInShadowRoots([mutationRecord]);

      expect(result).toBe(false);
    });

    it("returns true if any mutation in the array is in a shadow root", () => {
      const customElement = document.createElement("custom-element");
      const shadowRoot = customElement.attachShadow({ mode: "open" });
      const shadowInput = document.createElement("input");
      shadowRoot.appendChild(shadowInput);

      const lightDiv = document.createElement("div");
      document.body.appendChild(lightDiv);

      const shadowMutation: MutationRecord = {
        type: "childList",
        addedNodes: NodeList.prototype,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: NodeList.prototype,
        target: shadowInput,
      };

      const lightMutation: MutationRecord = {
        type: "childList",
        addedNodes: NodeList.prototype,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: NodeList.prototype,
        target: lightDiv,
      };

      const result = domQueryService.checkMutationsInShadowRoots([lightMutation, shadowMutation]);

      expect(result).toBe(true);
    });
  });

  describe("checkForNewShadowRoots", () => {
    beforeEach(() => {
      // Clear any shadow roots from previous tests
      document.body.innerHTML = "";
      // Reset the observed shadow roots set
      domQueryService["observedShadowRoots"] = new WeakSet<ShadowRoot>();
    });

    it("returns true when a shadow root is not in the observed set", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const customElement = document.createElement("custom-element");
      customElement.attachShadow({ mode: "open" });
      document.body.appendChild(customElement);

      const result = domQueryService.checkForNewShadowRoots();

      expect(result).toBe(true);
    });

    it("returns false when all shadow roots are already observed", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const customElement = document.createElement("custom-element");
      const shadowRoot = customElement.attachShadow({ mode: "open" });
      document.body.appendChild(customElement);

      // Simulate the shadow root being observed by adding it to the tracked set
      domQueryService["observedShadowRoots"].add(shadowRoot);

      const result = domQueryService.checkForNewShadowRoots();

      expect(result).toBe(false);
    });

    it("returns false when there are no shadow roots on the page", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const result = domQueryService.checkForNewShadowRoots();

      expect(result).toBe(false);
    });

    it("returns true via narrow-scan and does not flip pageContainsShadowDom when latch was already true", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const host = document.createElement("custom-element");
      host.attachShadow({ mode: "open" });
      document.body.appendChild(host);

      const result = domQueryService.checkForNewShadowRoots([host]);

      expect(result).toBe(true);
      expect(domQueryService["pageContainsShadowDom"]).toBe(true);
    });

    it("flips pageContainsShadowDom from false to true when narrow-scan discovers a root", () => {
      domQueryService["pageContainsShadowDom"] = false;
      const host = document.createElement("custom-element");
      host.attachShadow({ mode: "open" });
      document.body.appendChild(host);

      const result = domQueryService.checkForNewShadowRoots([host]);

      expect(result).toBe(true);
      expect(domQueryService["pageContainsShadowDom"]).toBe(true);
    });

    it("preserves the cheap-page short-circuit when latch is false and addedElements is empty", () => {
      domQueryService["pageContainsShadowDom"] = false;

      const result = domQueryService.checkForNewShadowRoots([]);

      expect(result).toBe(false);
      expect(domQueryService["pageContainsShadowDom"]).toBe(false);
    });

    it("returns true when a new root is nested inside a known root (PM-29033)", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const outerHost = document.createElement("outer-host");
      const outerRoot = outerHost.attachShadow({ mode: "open" });
      // Regression case: a single-level narrow scan would miss this.
      domQueryService["observedShadowRoots"].add(outerRoot);
      document.body.appendChild(outerHost);

      const innerHost = document.createElement("inner-host");
      innerHost.attachShadow({ mode: "open" });
      outerRoot.appendChild(innerHost);

      const result = domQueryService.checkForNewShadowRoots([outerHost]);

      expect(result).toBe(true);
    });

    it("bails at MAX_DEEP_QUERY_RECURSION_DEPTH without throwing on pathological nesting", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const root0 = document.createElement("host-0");
      const shadow0 = root0.attachShadow({ mode: "open" });
      domQueryService["observedShadowRoots"].add(shadow0);
      document.body.appendChild(root0);

      let parentShadow: ShadowRoot = shadow0;
      // 6 observed nestings + a final unobserved root past the depth cap (4).
      for (let i = 1; i <= 6; i++) {
        const host = document.createElement(`host-${i}`);
        const shadow = host.attachShadow({ mode: "open" });
        if (i < 6) {
          domQueryService["observedShadowRoots"].add(shadow);
        }
        parentShadow.appendChild(host);
        parentShadow = shadow;
      }

      expect(() => domQueryService.checkForNewShadowRoots([root0])).not.toThrow();
    });

    it("handles a disconnected element in addedElements without crashing", () => {
      // External callers may not filter by `isConnected` like
      // `collect-autofill-content.service.ts` does.
      domQueryService["pageContainsShadowDom"] = false;
      const host = document.createElement("disconnected-host");
      host.attachShadow({ mode: "open" });
      expect(host.isConnected).toBe(false);

      expect(() => domQueryService.checkForNewShadowRoots([host])).not.toThrow();
    });

    it("handles duplicate entries in addedElements (defensive — Set-side dedup makes this rare)", () => {
      domQueryService["pageContainsShadowDom"] = true;
      const host = document.createElement("dup-host");
      host.attachShadow({ mode: "open" });
      document.body.appendChild(host);

      const result = domQueryService.checkForNewShadowRoots([host, host]);

      expect(result).toBe(true);
    });

    describe("classifyShadowRootScan (pure classifier)", () => {
      it("returns shortCircuit verdict when latch is false and no added elements", () => {
        domQueryService["pageContainsShadowDom"] = false;

        const verdict = domQueryService["classifyShadowRootScan"]();

        expect(verdict).toEqual({
          branch: "shortCircuit",
          foundNewRoot: false,
        });
      });

      it("returns a narrow verdict (not shortCircuit) when addedElements is non-empty even with latch false", () => {
        domQueryService["pageContainsShadowDom"] = false;
        const host = document.createElement("custom-element");

        const verdict = domQueryService["classifyShadowRootScan"]([host]);

        expect(verdict.branch).toBe("narrow");
      });

      it("does not mutate pageContainsShadowDom", () => {
        domQueryService["pageContainsShadowDom"] = false;
        const host = document.createElement("custom-element");
        host.attachShadow({ mode: "open" });
        document.body.appendChild(host);

        domQueryService["classifyShadowRootScan"]([host]);

        expect(domQueryService["pageContainsShadowDom"]).toBe(false);
      });
    });

    describe("markShadowDomPresent (named transition)", () => {
      it("flips pageContainsShadowDom to true", () => {
        domQueryService["pageContainsShadowDom"] = false;

        domQueryService["markShadowDomPresent"]();

        expect(domQueryService["pageContainsShadowDom"]).toBe(true);
      });
    });
  });
});
