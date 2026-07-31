import {
  DEEP_QUERY_SELECTOR_COMBINATOR,
  EVENTS,
  MAX_DEEP_QUERY_RECURSION_DEPTH,
  SHADOW_ROOT_CANDIDATE_NODE_NAMES,
} from "@bitwarden/common/autofill/constants";

import { nodeIsElement } from "../utils";

import {
  DomQueryService as DomQueryServiceInterface,
  ShadowRootScanResult,
} from "./abstractions/dom-query.service";

// Per-scan cap; the persistent cap lives in ShadowHostHydrationTracker.
const MAX_UNRESOLVED_SHADOW_HOSTS = 256;

// Shared so the observe sites can't drift apart.
const SHADOW_ROOT_OBSERVE_OPTIONS: MutationObserverInit = {
  attributes: true,
  childList: true,
  subtree: true,
};

/**
 * The two bins one shadow-root scan fills — hosts to re-scan, roots not seen before — plus the
 * observer to enroll discovered roots with. With no `observer` the scan still reports what it
 * found but enrolls nothing; a later walk that supplies one will.
 */
type ShadowScanContext = {
  unresolvedHosts: Set<Element>;
  discoveredRoots: Set<ShadowRoot>;
  observer?: MutationObserver;
};

export class DomQueryService implements DomQueryServiceInterface {
  /** One-way ratchet — never reset; `resetObservedShadowRoots()` clears only the root set. */
  private pageContainsShadowDom!: boolean;
  // Stale entries (roots whose hosts left the DOM) are harmless — querying them
  // returns an empty NodeList. Cleared on `resetObservedShadowRoots` (navigation).
  private knownShadowRoots = new Set<ShadowRoot>();
  private isOwnedShadowHost: (host: Element) => boolean = () => false;
  private ignoredTreeWalkerNodes = new Set([
    "svg",
    "script",
    "noscript",
    "head",
    "style",
    "link",
    "meta",
    "title",
    "base",
    "img",
    "picture",
    "video",
    "audio",
    "object",
    "source",
    "track",
    "param",
    "map",
    "area",
  ]);

  constructor() {
    void this.init();
  }

  /**
   * Sets up a query that will trigger a deepQuery of the DOM, querying all elements that match the given query string.
   * If the deepQuery fails or reaches a max recursion depth, it will fall back to a treeWalker query.
   *
   * @param root - The root element to start the query from
   * @param queryString - The query string to match elements against
   * @param treeWalkerFilter - The filter callback to use for the treeWalker query
   * @param mutationObserver - The MutationObserver to use for observing shadow roots
   * @param forceDeepQueryAttempt - Whether to force a deep query attempt
   */
  query<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    treeWalkerFilter: (element: Element) => boolean,
    mutationObserver?: MutationObserver,
    forceDeepQueryAttempt?: boolean,
  ): T[] {
    if (!forceDeepQueryAttempt) {
      return this.queryWithUnresolvedShadowHosts<T>(root, treeWalkerFilter, mutationObserver)
        .elements;
    }

    try {
      return this.deepQueryElements<T>(root, queryString, mutationObserver);
    } catch {
      return this.queryWithUnresolvedShadowHosts<T>(root, treeWalkerFilter, mutationObserver)
        .elements;
    }
  }

  /** {@link query} plus the un-hydrated custom-element hosts seen along the way. */
  queryWithUnresolvedShadowHosts<T>(
    root: Document | ShadowRoot | Element,
    treeWalkerFilter: (element: Element) => boolean,
    mutationObserver?: MutationObserver,
  ): { elements: T[]; unresolvedHosts: Set<Element> } {
    const elements: T[] = [];
    const unresolvedHosts = new Set<Element>();

    this.buildTreeWalkerNodesQueryResults(
      root,
      elements,
      treeWalkerFilter,
      mutationObserver,
      unresolvedHosts,
    );

    return { elements, unresolvedHosts };
  }

  /**
   * Queries the page for shadow DOM elements and updates the cached state.
   * Use this when you need to refresh the shadow DOM detection state.
   *
   * @returns True if the page contains any shadow DOM elements
   */
  updatePageContainsShadowDom = (): boolean => {
    this.pageContainsShadowDom = this.queryShadowRoots(globalThis.document.body, true).length > 0;
    return this.pageContainsShadowDom;
  };

  // May be the page's first signal; scan while the latch is false (ratchet preserved).
  refreshShadowDomStateForUserRequest = (): void => {
    if (!this.pageContainsShadowDom) {
      this.updatePageContainsShadowDom();
    }
  };

  /**
   * Checks if any of the provided mutations occurred within shadow roots.
   * This is a lightweight check that doesn't query the DOM.
   * @param mutations - The mutation records to check
   * @returns True if any mutation occurred within a shadow root
   */
  checkMutationsInShadowRoots = (mutations: MutationRecord[]): boolean => {
    // Latch is a one-way ratchet (see `markShadowDomPresent`); false here means no
    // shadow root has been observed yet, so no mutation target can be inside one.
    if (!this.pageContainsShadowDom) {
      return false;
    }
    return mutations.some((mutation) => {
      const root = (mutation.target as Node).getRootNode();
      // Ignore our own injected shadow hosts — observing them churns on the menu's own styling.
      return root instanceof ShadowRoot && !this.isOwnedShadowHost(root.host);
    });
  };

  /** Identity predicate for the extension's own injected shadow hosts, excluded from scanning/observation. */
  setOwnedShadowHostPredicate = (predicate: (host: Element) => boolean): void => {
    this.isOwnedShadowHost = predicate;
  };

  /** Also collects still-shadow-less hosts, so the caller can re-scan them after hydration. */
  checkForNewShadowRoots = (
    addedElements?: Element[],
    mutationObserver?: MutationObserver,
  ): ShadowRootScanResult => {
    const scan: ShadowScanContext = {
      unresolvedHosts: new Set(),
      discoveredRoots: new Set(),
      observer: mutationObserver,
    };
    // No batch ⇒ short-circuit; never a full-document walk (O(document), re-pierces roots).
    if (!addedElements?.length) {
      return { foundNewRoot: false, unresolvedHosts: scan.unresolvedHosts };
    }
    this.findNewShadowRootInBatch(addedElements, scan);
    const foundNewRoot = scan.discoveredRoots.size > 0;
    if (foundNewRoot && !this.pageContainsShadowDom) {
      this.markShadowDomPresent();
    }
    return { foundNewRoot, unresolvedHosts: scan.unresolvedHosts };
  };

  private findNewShadowRootInBatch = (elements: Element[], scan: ShadowScanContext): void => {
    // Drop descendants of other batch elements — same subtree, re-walked.
    const roots = this.suppressDescendantsInBatch(elements);
    for (const el of roots) {
      this.scanForNewShadowRootInSubtree(el, 0, scan);
    }
  };

  /** O(N²) over the batch — N is bounded upstream by `pendingMutationAddedElementsCap`. */
  private suppressDescendantsInBatch = (elements: Element[]): Element[] => {
    if (elements.length < 2) {
      return elements;
    }
    const roots: Element[] = [];
    for (const candidate of elements) {
      let coveredByAnotherElement = false;
      for (const other of elements) {
        if (other !== candidate && other.contains(candidate)) {
          coveredByAnotherElement = true;
          break;
        }
      }
      if (!coveredByAnotherElement) {
        roots.push(candidate);
      }
    }
    return roots;
  };

  private markShadowDomPresent = (): void => {
    this.pageContainsShadowDom = true;
  };

  /**
   * Resets the observed shadow roots tracking. This should be called when the mutation
   * observer is recreated or on significant lifecycle events (like navigation).
   */
  resetObservedShadowRoots = (): void => {
    this.knownShadowRoots.clear();
  };

  // `ShadowRoot.host` is non-nullable per spec; persists after host removal from document.
  purgeDetachedShadowRoots = (): void => {
    for (const root of this.knownShadowRoots) {
      if (!root.host.isConnected) {
        this.knownShadowRoots.delete(root);
      }
    }
  };

  /**
   * Queries the DOM for elements based on the given selector string.
   * Supports the special `>>>` combinator to traverse iframe and shadow DOM
   * boundaries; each segment separated by `>>>` is queried within the context
   * produced by the previous segment. Boundary type is determined exclusively
   * by the resolved element type — iframe elements always use iframe traversal,
   * all other elements always use shadow DOM traversal, with no fallback between
   * the two. This enforces the contract expressed in the targeting rule.
   *
   * @param selector selector string, supports boundary-piercing with `>>>`
   * @returns The first matching element, or null if no match is found
   */
  queryDeepSelector(selector: string): Element | null {
    if (!selector) {
      return null;
    }

    const segments = selector.split(DEEP_QUERY_SELECTOR_COMBINATOR);
    let context: Document | ShadowRoot | Element = globalThis.document;

    for (let i = 0; i < segments.length; i++) {
      const segment = (segments[i] || "").trim();
      if (segment.length < 1) {
        return null;
      }

      const element: Element | null = context.querySelector(segment);
      if (!element) {
        return null;
      }

      if (i < segments.length - 1) {
        // FIXME: When a targeting rule specifies `iframe#foo`, we should fail
        // authoritatively if `#foo` does not resolve to an iframe (rather than
        // falling back to shadow traversal). The current test-and-fallback can
        // mask stale or inaccurate selectors.
        const next: Document | ShadowRoot | null =
          element instanceof HTMLIFrameElement
            ? element.contentDocument
            : this.traverseShadowRootBoundary(element);
        if (!next) {
          return null;
        }
        context = next;
      } else {
        return element;
      }
    }

    return null;
  }

  /**
   * Walks a selector and returns the first iframe boundary encountered along
   * with the remaining selector to apply inside that iframe.  Shadow DOM
   * boundaries before the iframe are traversed normally. Returns null if no
   * iframe boundary exists in the selector (pure shadow DOM or direct element).
   *
   * @param selector - Selector string using `>>>` as the boundary combinator
   */
  findIframeCrossing(
    selector: string,
  ): { iframeElement: HTMLIFrameElement; innerSelector: string } | null {
    const segments = selector.split(DEEP_QUERY_SELECTOR_COMBINATOR);
    if (segments.length < 2) {
      return null;
    }

    let context: Document | ShadowRoot | Element = globalThis.document;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = (segments[i] || "").trim();
      if (!segment) {
        return null;
      }

      const element: Element | null = context.querySelector(segment);
      if (!element) {
        return null;
      }

      if (element instanceof HTMLIFrameElement) {
        return {
          iframeElement: element,
          innerSelector: segments.slice(i + 1).join(DEEP_QUERY_SELECTOR_COMBINATOR),
        };
      }

      const shadow = this.getShadowRoot(element);
      if (!shadow) {
        return null;
      }
      context = shadow;
    }

    return null;
  }

  /**
   * Returns the shadow root of an element, or null if no shadow root exists.
   * Explicitly refuses to traverse iframe elements — callers must read
   * `contentDocument` directly for those.
   */
  private traverseShadowRootBoundary(element: Element): ShadowRoot | null {
    if (element instanceof HTMLIFrameElement) {
      return null;
    }
    return this.getShadowRoot(element);
  }

  /**
   * Initializes the DomQueryService, checking for the presence of shadow DOM elements on the page.
   */
  private async init() {
    if (globalThis.document.readyState === "complete") {
      this.updatePageContainsShadowDom();
      return;
    }
    globalThis.addEventListener(EVENTS.LOAD, this.updatePageContainsShadowDom);
  }

  /**
   * Queries all elements in the DOM that match the given query string.
   * Also, recursively queries all shadow roots for the element.
   *
   * @param root - The root element to start the query from
   * @param queryString - The query string to match elements against
   * @param mutationObserver - The MutationObserver to use for observing shadow roots
   */
  private deepQueryElements<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    mutationObserver?: MutationObserver,
  ): T[] {
    let elements = this.queryElements<T>(root, queryString);

    if (!this.pageContainsShadowDom) {
      return elements;
    }

    // Re-use the already-discovered shadow roots when possible to avoid the
    // expensive querySelectorAll("*") + tag-name scan on every call.
    // FIXME: shadow roots added to the main document after initialization are not
    // included in this set until `resetObservedShadowRoots()` is called. (i.e.
    // when the mutation observer is rebuilt)
    const shadowRoots =
      this.knownShadowRoots.size > 0
        ? Array.from(this.knownShadowRoots)
        : this.recursivelyQueryShadowRoots(root);

    for (let index = 0; index < shadowRoots.length; index++) {
      const shadowRoot = shadowRoots[index];
      elements = elements.concat(this.queryElements<T>(shadowRoot, queryString));

      if (mutationObserver) {
        this.enrollShadowRoot(shadowRoot, mutationObserver);
      }
    }

    return elements;
  }

  /**
   * Queries the DOM for elements based on the given query string.
   *
   * @param root - The root element to start the query from
   * @param queryString - The query string to match elements against
   */
  private queryElements<T>(root: Document | ShadowRoot | Element, queryString: string): T[] {
    // Avoid a redundant pre-check querySelector — querySelectorAll already
    // returns an empty NodeList when nothing matches, at no extra cost.
    return Array.from(root.querySelectorAll(queryString)) as T[];
  }

  // No cycle guard — `attachShadow` throws on re-attach, `ShadowRoot.host` is
  // read-only. See https://dom.spec.whatwg.org/#dom-element-attachshadow.
  private scanForNewShadowRootInSubtree = (
    subtree: Element | ShadowRoot,
    depth: number,
    scan: ShadowScanContext,
  ): void => {
    if (depth >= MAX_DEEP_QUERY_RECURSION_DEPTH) {
      return;
    }
    // Host check — `querySelectorAll("*")` excludes the scope element.
    if (nodeIsElement(subtree)) {
      this.visitShadowHostCandidate(subtree, depth, scan);
    }
    // querySelectorAll doesn't pierce shadow boundaries — recurse per boundary.
    for (const child of subtree.querySelectorAll("*")) {
      this.visitShadowHostCandidate(child, depth, scan);
    }
  };

  /**
   * Bounded per scan, and never a host we own — the extension must not walk its own inline menu.
   * The one home for this rule; both sink sites go through it.
   */
  private sinkUnresolvedHost = (element: Element, sink: Set<Element>): void => {
    if (
      sink.size < MAX_UNRESOLVED_SHADOW_HOSTS &&
      element.tagName.includes("-") &&
      !element.shadowRoot &&
      !this.isOwnedShadowHost(element)
    ) {
      sink.add(element);
    }
  };

  private visitShadowHostCandidate = (
    element: Element,
    depth: number,
    scan: ShadowScanContext,
  ): void => {
    const root = this.getShadowRoot(element);
    if (!root) {
      this.sinkUnresolvedHost(element, scan.unresolvedHosts);
      return;
    }
    if (!this.knownShadowRoots.has(root)) {
      scan.discoveredRoots.add(root);
      // With an observer in hand, enroll here rather than re-finding the root in a later walk.
      if (scan.observer) {
        this.enrollShadowRoot(root, scan.observer);
      }
    }
    // Descend even into a new root — its own un-hydrated hosts still belong in the sink.
    this.scanForNewShadowRootInSubtree(root, depth + 1, scan);
  };

  /**
   * Always both, in that order, so `knownShadowRoots` never holds a root we aren't watching.
   */
  private enrollShadowRoot = (root: ShadowRoot, observer: MutationObserver): void => {
    observer.observe(root, SHADOW_ROOT_OBSERVE_OPTIONS);
    this.knownShadowRoots.add(root);
  };

  /**
   * Recursively queries all shadow roots found within the given root element.
   * Will also set up a mutation observer on the shadow root if the
   * `isObservingShadowRoot` parameter is set to true.
   *
   * @param root - The root element to start the query from
   * @param depth - The depth of the recursion
   */
  private recursivelyQueryShadowRoots(
    root: Document | ShadowRoot | Element,
    depth: number = 0,
  ): ShadowRoot[] {
    if (depth >= MAX_DEEP_QUERY_RECURSION_DEPTH) {
      throw new Error("Max recursion depth reached");
    }

    let shadowRoots = this.queryShadowRoots(root);
    for (let index = 0; index < shadowRoots.length; index++) {
      const shadowRoot = shadowRoots[index];
      shadowRoots = shadowRoots.concat(this.recursivelyQueryShadowRoots(shadowRoot, depth + 1));
    }

    return shadowRoots;
  }

  /**
   * Queries any immediate shadow roots found within the given root element.
   *
   * @param root - The root element to start the query from
   * @param returnSingleShadowRoot - Whether to return a single shadow root or an array of shadow roots
   */
  private queryShadowRoots(
    root: Document | ShadowRoot | Element,
    returnSingleShadowRoot = false,
  ): ShadowRoot[] {
    if (!root) {
      return [];
    }

    const shadowRoots: ShadowRoot[] = [];
    for (const potentialShadowRoot of root.querySelectorAll("*")) {
      const shadowRoot = this.getShadowRoot(potentialShadowRoot);
      if (shadowRoot) {
        shadowRoots.push(shadowRoot);
      }

      if (returnSingleShadowRoot && shadowRoots.length) {
        break;
      }
    }

    return shadowRoots;
  }

  /**
   * Attempts to get the ShadowRoot of the passed node. If support for the
   * extension based openOrClosedShadowRoot API is available, it will be used.
   * Will return null if the node is not an HTMLElement or if the node has
   * child nodes.
   *
   * @param {Node} node
   */
  private getShadowRoot(node: Node): ShadowRoot | null {
    if (!nodeIsElement(node)) {
      return null;
    }

    if (this.isOwnedShadowHost(node)) {
      return null;
    }

    // Fast path first: element.shadowRoot is cheap and works on any element with
    // an open root.
    if (node.shadowRoot) {
      return node.shadowRoot;
    }

    // skip nodes that cannot contain shadow roots
    const isCandidate =
      SHADOW_ROOT_CANDIDATE_NODE_NAMES.has(node.nodeName) || node.nodeName.includes("-");
    if (!isCandidate) {
      return null;
    }

    // Fall back to chrome.dom.openOrClosedShadowRoot for closed
    // roots — the expensive cross-boundary call — on any host element, since
    // closed roots can be (and are) attached to plain HTML hosts in the wild.
    if ((chrome as any).dom?.openOrClosedShadowRoot) {
      try {
        return (chrome as any).dom.openOrClosedShadowRoot(node);
      } catch {
        return null;
      }
    }

    // Firefox-specific equivalent of `openOrClosedShadowRoot`
    return (node as any).openOrClosedShadowRoot;
  }

  /**
   * Recursively collects filter-matching nodes, descending through each shadow boundary.
   * `unresolvedHosts` is the only enrollment source for hosts that predate observer attachment.
   */
  private buildTreeWalkerNodesQueryResults<T>(
    rootNode: Node,
    treeWalkerQueryResults: T[],
    filterCallback: (element: Element) => boolean,
    mutationObserver: MutationObserver | undefined,
    unresolvedHosts: Set<Element>,
  ) {
    const treeWalker = document?.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, (node) =>
      this.ignoredTreeWalkerNodes.has(node.nodeName?.toLowerCase())
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
    );

    do {
      const currentNode: Node | Element | null = treeWalker.currentNode;

      // `currentNode` can be one of two things: the root node (which is a `Node`),
      // or an `Element` (due to the `NodeFilter.SHOW_ELEMENT`). Therefore,
      // `currentNode` is an `Element` if it is not the root node, or if it
      // is an element.
      let currentElement: Element;
      if (currentNode != treeWalker.root || nodeIsElement(currentNode)) {
        currentElement = currentNode as Element;
      } else {
        continue;
      }

      if (filterCallback(currentElement)) {
        treeWalkerQueryResults.push(currentNode as T);
      }

      // Declared outside the latch check on purpose: the sink below must still run when the
      // latch is false, which is when no probe happens at all.
      let nodeShadowRoot: ShadowRoot | null = null;
      if (this.pageContainsShadowDom) {
        nodeShadowRoot = currentElement.shadowRoot ?? this.getShadowRoot(currentElement);
      }
      if (nodeShadowRoot) {
        if (mutationObserver) {
          this.enrollShadowRoot(nodeShadowRoot, mutationObserver);
        }

        this.buildTreeWalkerNodesQueryResults(
          nodeShadowRoot,
          treeWalkerQueryResults,
          filterCallback,
          mutationObserver,
          unresolvedHosts,
        );
      } else {
        this.sinkUnresolvedHost(currentElement, unresolvedHosts);
      }
    } while (treeWalker.nextNode());
  }
}
