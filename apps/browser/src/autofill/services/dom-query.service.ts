import { EVENTS, MAX_DEEP_QUERY_RECURSION_DEPTH } from "@bitwarden/common/autofill/constants";

import { nodeIsElement } from "../utils";

import { DomQueryService as DomQueryServiceInterface } from "./abstractions/dom-query.service";

export class DomQueryService implements DomQueryServiceInterface {
  private pageContainsShadowDom!: boolean;
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
   * Checks if the page contains any shadow DOM elements.
   */
  checkPageContainsShadowDom = (): boolean => {
    this.pageContainsShadowDom = this.queryShadowRoots(globalThis.document.body, true).length > 0;
    return this.pageContainsShadowDom;
  };

  /**
   * Initializes the DomQueryService, checking for the presence of shadow DOM elements on the page.
   */
  private async init() {
    if (globalThis.document.readyState === "complete") {
      this.checkPageContainsShadowDom();
      return;
    }
    globalThis.addEventListener(EVENTS.LOAD, this.checkPageContainsShadowDom);
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

    const shadowRoots = this.pageContainsShadowDom ? this.recursivelyQueryShadowRoots(root) : [];
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
    if (!root.querySelector(queryString)) {
      return [];
    }

    return Array.from(root.querySelectorAll(queryString)) as T[];
  }

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
    const potentialShadowRoots = root.querySelectorAll(":defined");
    for (let index = 0; index < potentialShadowRoots.length; index++) {
      const shadowRoot = this.getShadowRoot(potentialShadowRoots[index]);
      if (!shadowRoot) {
        continue;
      }

      shadowRoots.push(shadowRoot);
      if (returnSingleShadowRoot) {
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

    if (node.shadowRoot) {
      return node.shadowRoot;
    }

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

      const nodeShadowRoot = this.getShadowRoot(currentNode);
      if (nodeShadowRoot) {
        if (mutationObserver) {
          mutationObserver.observe(nodeShadowRoot, {
            attributes: true,
            childList: true,
            subtree: true,
          });
        }

        this.buildTreeWalkerNodesQueryResults(
          nodeShadowRoot,
          treeWalkerQueryResults,
          filterCallback,
          ignoredTreeWalkerNodes,
          mutationObserver,
        );
      }

      currentNode = treeWalker?.nextNode();
    }
  }
}
