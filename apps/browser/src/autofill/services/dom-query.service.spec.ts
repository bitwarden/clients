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

  describe("queryDeepSelector", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("returns null for an empty selector", () => {
      expect(domQueryService.queryDeepSelector("")).toBeNull();
    });

    it("returns null when a selector segment is empty", () => {
      expect(domQueryService.queryDeepSelector(">>> >>>")).toBeNull();
    });

    it("returns an element matching a simple selector", () => {
      const input = document.createElement("input");
      input.id = "username";
      document.body.appendChild(input);

      expect(domQueryService.queryDeepSelector("#username")).toBe(input);
    });

    it("returns null when no element matches a simple selector", () => {
      expect(domQueryService.queryDeepSelector("#nonexistent")).toBeNull();
    });

    it("traverses a shadow DOM boundary", () => {
      const host = document.createElement("div");
      host.id = "shadow-host";
      document.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      input.id = "shadow-input";
      shadowRoot.appendChild(input);

      expect(domQueryService.queryDeepSelector("#shadow-host >>> #shadow-input")).toBe(input);
    });

    it("returns null when an intermediate element has no shadow root and is not an iframe", () => {
      const div = document.createElement("div");
      div.id = "plain-div";
      document.body.appendChild(div);

      expect(domQueryService.queryDeepSelector("#plain-div >>> #child")).toBeNull();
    });

    it("traverses a same-origin iframe boundary", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "test-iframe";
      document.body.appendChild(iframe);
      const input = iframe.contentDocument!.createElement("input");
      input.id = "iframe-input";
      iframe.contentDocument!.body.appendChild(input);

      expect(domQueryService.queryDeepSelector("#test-iframe >>> #iframe-input")).toBe(input);
    });

    it("returns null when the iframe contentDocument is not accessible", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "cross-origin-iframe";
      document.body.appendChild(iframe);
      Object.defineProperty(iframe, "contentDocument", { value: null, configurable: true });

      expect(domQueryService.queryDeepSelector("#cross-origin-iframe >>> #some-input")).toBeNull();
    });

    it("returns null for an inaccessible iframe without falling back to shadow DOM", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "inaccessible-iframe";
      document.body.appendChild(iframe);
      Object.defineProperty(iframe, "contentDocument", { value: null, configurable: true });

      expect(domQueryService.queryDeepSelector("#inaccessible-iframe >>> #some-input")).toBeNull();
    });

    it("traverses multiple boundaries in sequence", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "outer-iframe";
      document.body.appendChild(iframe);
      const host = iframe.contentDocument!.createElement("div");
      host.id = "shadow-host";
      iframe.contentDocument!.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: "open" });
      const input = document.createElement("input");
      input.id = "deep-input";
      shadowRoot.appendChild(input);

      expect(
        domQueryService.queryDeepSelector("#outer-iframe >>> #shadow-host >>> #deep-input"),
      ).toBe(input);
    });
  });
});
