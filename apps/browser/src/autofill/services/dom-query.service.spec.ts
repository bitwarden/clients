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

    it("traverses deeply nested shadow roots (four levels)", () => {
      const host1 = document.createElement("div");
      host1.id = "host-1";
      document.body.appendChild(host1);
      const shadow1 = host1.attachShadow({ mode: "open" });

      const host2 = document.createElement("div");
      host2.id = "host-2";
      shadow1.appendChild(host2);
      const shadow2 = host2.attachShadow({ mode: "open" });

      const host3 = document.createElement("div");
      host3.id = "host-3";
      shadow2.appendChild(host3);
      const shadow3 = host3.attachShadow({ mode: "open" });

      const host4 = document.createElement("div");
      host4.id = "host-4";
      shadow3.appendChild(host4);
      const shadow4 = host4.attachShadow({ mode: "open" });

      const input = document.createElement("input");
      input.id = "deeply-nested-input";
      shadow4.appendChild(input);

      expect(
        domQueryService.queryDeepSelector(
          "#host-1 >>> #host-2 >>> #host-3 >>> #host-4 >>> #deeply-nested-input",
        ),
      ).toBe(input);
    });

    it("traverses an iframe nested inside a shadow host", () => {
      // jsdom only initializes contentDocument for iframes attached to the live
      // document tree, so harvest a usable Document from a sibling iframe.
      const docSource = document.createElement("iframe");
      document.body.appendChild(docSource);
      const iframeDoc = docSource.contentDocument!;

      const host = document.createElement("div");
      host.id = "shadow-host";
      document.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: "open" });

      const iframe = document.createElement("iframe");
      iframe.id = "shadowed-iframe";
      shadowRoot.appendChild(iframe);
      Object.defineProperty(iframe, "contentDocument", {
        value: iframeDoc,
        configurable: true,
      });

      const input = iframeDoc.createElement("input");
      input.id = "iframe-input";
      iframeDoc.body.appendChild(input);

      expect(
        domQueryService.queryDeepSelector(
          "#shadow-host >>> iframe#shadowed-iframe >>> input#iframe-input",
        ),
      ).toBe(input);
    });

    it("traverses an iframe nested inside another iframe", () => {
      // jsdom does not auto-create contentDocument for iframes inside another
      // iframe's document, so harvest one from a sibling iframe on the main doc.
      const docSource = document.createElement("iframe");
      document.body.appendChild(docSource);
      const innerDoc = docSource.contentDocument!;

      const outerIframe = document.createElement("iframe");
      outerIframe.id = "outer-iframe";
      document.body.appendChild(outerIframe);

      // Create the inner iframe in the main document so it's an instance of the
      // main window's HTMLIFrameElement, then place it inside the outer iframe's
      // document body.
      const innerIframe = document.createElement("iframe");
      innerIframe.id = "inner-iframe";
      outerIframe.contentDocument!.body.appendChild(innerIframe);
      Object.defineProperty(innerIframe, "contentDocument", {
        value: innerDoc,
        configurable: true,
      });

      const input = innerDoc.createElement("input");
      input.id = "nested-iframe-input";
      innerDoc.body.appendChild(input);

      expect(
        domQueryService.queryDeepSelector(
          "iframe#outer-iframe >>> iframe#inner-iframe >>> input#nested-iframe-input",
        ),
      ).toBe(input);
    });
  });
});
