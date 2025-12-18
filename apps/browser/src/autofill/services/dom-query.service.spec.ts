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
      domQueryService["checkPageContainsShadowDom"],
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
    it("returns true when a shadow root is not in the observed set", () => {
      const customElement = document.createElement("custom-element");
      customElement.attachShadow({ mode: "open" });
      document.body.appendChild(customElement);

      const result = domQueryService.checkForNewShadowRoots();

      expect(result).toBe(true);
    });

    it("returns false when all shadow roots are already observed", () => {
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
  });
});
