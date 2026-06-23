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
      domQueryService["pageContainsShadowDom"] = true;
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
      domQueryService["pageContainsShadowDom"] = true;
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
      domQueryService["pageContainsShadowDom"] = true;
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

    it("returns false without walking targets when pageContainsShadowDom is false", () => {
      domQueryService["pageContainsShadowDom"] = false;
      const target = document.createElement("div");
      document.body.appendChild(target);
      const getRootNodeSpy = jest.spyOn(target, "getRootNode");
      const mutationRecord: MutationRecord = {
        type: "childList",
        addedNodes: NodeList.prototype,
        attributeName: null,
        attributeNamespace: null,
        nextSibling: null,
        oldValue: null,
        previousSibling: null,
        removedNodes: NodeList.prototype,
        target,
      };

      const result = domQueryService.checkMutationsInShadowRoots([mutationRecord]);

      expect(result).toBe(false);
      expect(getRootNodeSpy).not.toHaveBeenCalled();
    });

    it("still detects shadow-root mutations once markShadowDomPresent flips the latch", () => {
      domQueryService["pageContainsShadowDom"] = false;
      const customElement = document.createElement("custom-element");
      const shadowRoot = customElement.attachShadow({ mode: "open" });
      const shadowInput = document.createElement("input");
      shadowRoot.appendChild(shadowInput);
      const mutationRecord: MutationRecord = {
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

      expect(domQueryService.checkMutationsInShadowRoots([mutationRecord])).toBe(false);

      domQueryService["markShadowDomPresent"]();

      expect(domQueryService.checkMutationsInShadowRoots([mutationRecord])).toBe(true);
    });
  });

  describe("purgeDetachedShadowRoots", () => {
    it("removes only entries whose host has left the document", () => {
      const attachedHost = document.createElement("attached-host");
      const attachedRoot = attachedHost.attachShadow({ mode: "open" });
      document.body.appendChild(attachedHost);

      const detachedHost = document.createElement("detached-host");
      const detachedRoot = detachedHost.attachShadow({ mode: "open" });
      // detachedHost is never appended to the document, so host.isConnected is false.

      domQueryService["knownShadowRoots"].add(attachedRoot);
      domQueryService["knownShadowRoots"].add(detachedRoot);

      domQueryService.purgeDetachedShadowRoots();

      expect(domQueryService["knownShadowRoots"].size).toBe(1);
      expect(domQueryService["knownShadowRoots"].has(attachedRoot)).toBe(true);
      expect(domQueryService["knownShadowRoots"].has(detachedRoot)).toBe(false);
    });

    it("leaves connected entries in place", () => {
      const host = document.createElement("attached-host");
      const root = host.attachShadow({ mode: "open" });
      document.body.appendChild(host);
      domQueryService["knownShadowRoots"].add(root);

      domQueryService.purgeDetachedShadowRoots();

      expect(domQueryService["knownShadowRoots"].size).toBe(1);
    });
  });

  describe("checkForNewShadowRoots", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      domQueryService["knownShadowRoots"].clear();
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
      domQueryService["knownShadowRoots"].add(shadowRoot);

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
      domQueryService["knownShadowRoots"].add(outerRoot);
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
      domQueryService["knownShadowRoots"].add(shadow0);
      document.body.appendChild(root0);

      let parentShadow: ShadowRoot = shadow0;
      // 6 observed nestings + a final unobserved root past the depth cap (4).
      for (let i = 1; i <= 6; i++) {
        const host = document.createElement(`host-${i}`);
        const shadow = host.attachShadow({ mode: "open" });
        if (i < 6) {
          domQueryService["knownShadowRoots"].add(shadow);
        }
        parentShadow.appendChild(host);
        parentShadow = shadow;
      }

      expect(() => domQueryService.checkForNewShadowRoots([root0])).not.toThrow();
    });

    it("handles a disconnected element in addedElements without crashing", () => {
      // External callers may not filter by `isConnected`.
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

    describe("suppressDescendantsInBatch (ancestor coverage)", () => {
      it("returns the array unchanged when fewer than two elements", () => {
        const only = document.createElement("div");

        expect(domQueryService["suppressDescendantsInBatch"]([])).toEqual([]);
        expect(domQueryService["suppressDescendantsInBatch"]([only])).toEqual([only]);
      });

      it("drops descendants whose ancestor is also in the batch", () => {
        const parent = document.createElement("section");
        const child = document.createElement("div");
        parent.appendChild(child);

        const roots = domQueryService["suppressDescendantsInBatch"]([parent, child]);

        expect(roots).toEqual([parent]);
      });

      it("keeps unrelated siblings", () => {
        const a = document.createElement("section");
        const b = document.createElement("article");

        const roots = domQueryService["suppressDescendantsInBatch"]([a, b]);

        expect(roots).toEqual([a, b]);
      });
    });

    describe("ancestor suppression cuts redundant subtree walks in findNewShadowRootInBatch", () => {
      it("only scans the ancestor when a descendant is also in the batch", () => {
        domQueryService["pageContainsShadowDom"] = true;
        const parent = document.createElement("section");
        const child = document.createElement("div");
        parent.appendChild(child);
        document.body.appendChild(parent);
        const scanSpy = jest.spyOn(
          domQueryService as unknown as { scanForNewShadowRootInSubtree: jest.Mock },
          "scanForNewShadowRootInSubtree",
        );

        domQueryService.checkForNewShadowRoots([parent, child]);

        // First call is the parent at depth 0; without suppression we'd see
        // a second top-level call for `child`.
        const topLevelCalls = scanSpy.mock.calls.filter(([, depth]) => depth === 0);
        expect(topLevelCalls.length).toBe(1);
        expect(topLevelCalls[0][0]).toBe(parent);
      });
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

  describe("findIframeCrossing", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("returns null for selectors without an iframe boundary", () => {
      expect(domQueryService.findIframeCrossing("#username")).toBeNull();
    });

    it("returns null when no element matches the iframe segment", () => {
      expect(domQueryService.findIframeCrossing("iframe#nonexistent >>> #username")).toBeNull();
    });

    it("returns the iframe element and inner selector for a single-hop boundary", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "login-iframe";
      document.body.appendChild(iframe);

      const result = domQueryService.findIframeCrossing("iframe#login-iframe >>> #username");

      expect(result).not.toBeNull();
      expect(result!.iframeElement).toBe(iframe);
      expect(result!.innerSelector.trim()).toBe("#username");
    });

    it("returns the boundary even when iframe.contentDocument is null (cross-origin)", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "cross-origin-iframe";
      document.body.appendChild(iframe);
      Object.defineProperty(iframe, "contentDocument", { value: null, configurable: true });

      const result = domQueryService.findIframeCrossing("iframe#cross-origin-iframe >>> #username");

      expect(result).not.toBeNull();
      expect(result!.iframeElement).toBe(iframe);
      expect(result!.innerSelector.trim()).toBe("#username");
    });

    it("returns the boundary even when iframe.src is empty (srcdoc / about:blank)", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "srcdoc-iframe";
      // No src or srcdoc set — leaves iframe.src as empty string
      document.body.appendChild(iframe);

      const result = domQueryService.findIframeCrossing("iframe#srcdoc-iframe >>> #username");

      expect(result).not.toBeNull();
      expect(result!.iframeElement).toBe(iframe);
      expect(result!.iframeElement.src).toBe("");
    });

    it("preserves the remaining selector for multi-hop chains", () => {
      const iframe = document.createElement("iframe");
      iframe.id = "outer";
      document.body.appendChild(iframe);

      const result = domQueryService.findIframeCrossing(
        "iframe#outer >>> iframe#inner >>> #username",
      );

      expect(result).not.toBeNull();
      expect(result!.iframeElement).toBe(iframe);
      expect(result!.innerSelector.trim()).toBe("iframe#inner >>> #username");
    });

    it("walks shadow boundaries before reaching the iframe", () => {
      const host = document.createElement("div");
      host.id = "shadow-host";
      document.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: "open" });
      const iframe = document.createElement("iframe");
      iframe.id = "inside-shadow";
      shadowRoot.appendChild(iframe);

      const result = domQueryService.findIframeCrossing(
        "#shadow-host >>> iframe#inside-shadow >>> #username",
      );

      expect(result).not.toBeNull();
      expect(result!.iframeElement).toBe(iframe);
      expect(result!.innerSelector.trim()).toBe("#username");
    });

    it("returns null when a pre-iframe segment cannot traverse (no shadow root, no iframe)", () => {
      const div = document.createElement("div");
      div.id = "plain-div";
      document.body.appendChild(div);

      expect(domQueryService.findIframeCrossing("#plain-div >>> iframe#inner >>> #x")).toBeNull();
    });
  });
});
