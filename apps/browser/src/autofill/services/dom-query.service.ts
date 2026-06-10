import {
  DEEP_QUERY_SELECTOR_COMBINATOR,
  EVENTS,
  MAX_DEEP_QUERY_RECURSION_DEPTH,
  SHADOW_ROOT_CANDIDATE_NODE_NAMES,
} from "@bitwarden/common/autofill/constants";

import { stopwatch } from "../content/performance";
import { nodeIsElement } from "../utils";

import { DomQueryService as DomQueryServiceInterface } from "./abstractions/dom-query.service";

type ScanVerdict =
  | { branch: "shortCircuit"; foundNewRoot: false }
  | { branch: "narrow"; foundNewRoot: boolean }
  | { branch: "fullScan"; foundNewRoot: boolean };

export class DomQueryService implements DomQueryServiceInterface {
  /** One-way ratchet; reset only by `resetObservedShadowRoots()`. */
  private pageContainsShadowDom!: boolean;
  // Stale entries (roots whose hosts left the DOM) are harmless — querying them
  // returns an empty NodeList. Cleared on `resetObservedShadowRoots` (navigation).
  private knownShadowRoots = new Set<ShadowRoot>();
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
    this.getShadowRoot = stopwatch("getShadowRoot", this.getShadowRoot);
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
   * @param ignoredTreeWalkerNodesOverride - An optional set of node names to ignore when using the treeWalker strategy
   */
  query<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    treeWalkerFilter: CallableFunction,
    mutationObserver?: MutationObserver,
    forceDeepQueryAttempt?: boolean,
    ignoredTreeWalkerNodesOverride?: Set<string>,
  ): T[] {
    const ignoredTreeWalkerNodes = ignoredTreeWalkerNodesOverride || this.ignoredTreeWalkerNodes;

    if (!forceDeepQueryAttempt) {
      return this.queryAllTreeWalkerNodes<T>(
        root,
        treeWalkerFilter,
        ignoredTreeWalkerNodes,
        mutationObserver,
      );
    }

    try {
      return this.deepQueryElements<T>(root, queryString, mutationObserver);
    } catch {
      return this.queryAllTreeWalkerNodes<T>(
        root,
        treeWalkerFilter,
        ignoredTreeWalkerNodes,
        mutationObserver,
      );
    }
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
      return root instanceof ShadowRoot;
    });
  };

  /** @returns true if an unobserved root is reachable; flips the latch on first post-init() find. */
  checkForNewShadowRoots = (addedElements?: Element[]): boolean => {
    const verdict = this.classifyShadowRootScan(addedElements);
    if (verdict.foundNewRoot && !this.pageContainsShadowDom) {
      this.markShadowDomPresent();
    }
    return verdict.foundNewRoot;
  };

  private classifyShadowRootScan = (addedElements?: Element[]): ScanVerdict => {
    const hasAddedElements = !!addedElements && addedElements.length > 0;
    // Batch present: scan even with latch false (shadow DOM may attach post-init).
    if (!this.pageContainsShadowDom && !hasAddedElements) {
      return { branch: "shortCircuit", foundNewRoot: false };
    }
    return hasAddedElements
      ? this.findNewShadowRootInBatch(addedElements!)
      : this.findNewShadowRootInDocument();
  };

  private findNewShadowRootInBatch = (elements: Element[]): ScanVerdict => {
    // Drop descendants of other batch elements — same subtree, re-walked.
    const roots = this.suppressDescendantsInBatch(elements);
    for (const el of roots) {
      if (this.scanForNewShadowRootInSubtree(el, 0)) {
        return { branch: "narrow", foundNewRoot: true };
      }
    }
    return { branch: "narrow", foundNewRoot: false };
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

  private findNewShadowRootInDocument = (): ScanVerdict => {
    let roots: ShadowRoot[];
    try {
      roots = this.recursivelyQueryShadowRoots(globalThis.document.body);
    } catch {
      roots = this.queryShadowRoots(globalThis.document.body);
    }
    return {
      branch: "fullScan",
      foundNewRoot: roots.some((r) => !this.knownShadowRoots.has(r)),
    };
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
        mutationObserver.observe(shadowRoot, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }
      this.knownShadowRoots.add(shadowRoot);
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
  ): boolean => {
    if (depth >= MAX_DEEP_QUERY_RECURSION_DEPTH) {
      return false;
    }
    // Host check — `querySelectorAll("*")` excludes the scope element.
    if (subtree instanceof Element) {
      const root = this.getShadowRoot(subtree);
      if (root) {
        if (!this.knownShadowRoots.has(root)) {
          return true;
        }
        if (this.scanForNewShadowRootInSubtree(root, depth + 1)) {
          return true;
        }
      }
    }
    // querySelectorAll doesn't pierce shadow boundaries — recurse per boundary.
    for (const child of subtree.querySelectorAll("*")) {
      const childRoot = this.getShadowRoot(child);
      if (childRoot) {
        if (!this.knownShadowRoots.has(childRoot)) {
          return true;
        }
        if (this.scanForNewShadowRootInSubtree(childRoot, depth + 1)) {
          return true;
        }
      }
    }
    return false;
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
   * Queries the DOM for all the nodes that match the given filter callback
   * and returns a collection of nodes.
   * @param rootNode
   * @param filterCallback
   * @param ignoredTreeWalkerNodes
   * @param mutationObserver
   */
  private queryAllTreeWalkerNodes<T>(
    rootNode: Node,
    filterCallback: CallableFunction,
    ignoredTreeWalkerNodes: Set<string>,
    mutationObserver?: MutationObserver,
  ): T[] {
    const treeWalkerQueryResults: T[] = [];

    this.buildTreeWalkerNodesQueryResults(
      rootNode,
      treeWalkerQueryResults,
      filterCallback,
      ignoredTreeWalkerNodes,
      mutationObserver,
    );

    return treeWalkerQueryResults;
  }

  /**
   * Recursively builds a collection of nodes that match the given filter callback.
   * If a node has a ShadowRoot, it will be observed for mutations.
   *
   * @param rootNode
   * @param treeWalkerQueryResults
   * @param filterCallback
   * @param ignoredTreeWalkerNodes
   * @param mutationObserver
   */
  private buildTreeWalkerNodesQueryResults<T>(
    rootNode: Node,
    treeWalkerQueryResults: T[],
    filterCallback: CallableFunction,
    ignoredTreeWalkerNodes: Set<string>,
    mutationObserver?: MutationObserver,
  ) {
    const treeWalker = document?.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, (node) =>
      ignoredTreeWalkerNodes.has(node.nodeName?.toLowerCase())
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
    );
    let currentNode: Node | null = treeWalker?.currentNode;

    while (currentNode) {
      if (filterCallback(currentNode)) {
        treeWalkerQueryResults.push(currentNode as T);
      }

      // Only probe for a shadow root when the page is known to have shadow DOM.
      // Fast path: element.shadowRoot for open roots, free on any element type.
      // Fall back to the extension API (chrome.dom.openOrClosedShadowRoot) for
      // closed roots on any host element.
      if (this.pageContainsShadowDom && nodeIsElement(currentNode)) {
        const el = currentNode as Element;
        let nodeShadowRoot: ShadowRoot | null = el.shadowRoot;
        if (!nodeShadowRoot) {
          nodeShadowRoot = this.getShadowRoot(currentNode);
        }
        if (nodeShadowRoot) {
          if (mutationObserver) {
            mutationObserver.observe(nodeShadowRoot, {
              attributes: true,
              childList: true,
              subtree: true,
            });
          }
          this.knownShadowRoots.add(nodeShadowRoot);

          this.buildTreeWalkerNodesQueryResults(
            nodeShadowRoot,
            treeWalkerQueryResults,
            filterCallback,
            ignoredTreeWalkerNodes,
            mutationObserver,
          );
        }
      }

      currentNode = treeWalker?.nextNode();
    }
  }
}
