export interface DomQueryService {
  query<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    treeWalkerFilter: CallableFunction,
    mutationObserver?: MutationObserver,
    forceDeepQueryAttempt?: boolean,
    unresolvedHostSink?: Set<Element>,
  ): T[];
  updatePageContainsShadowDom(): boolean;
  refreshShadowDomStateForUserRequest(): void;
  checkMutationsInShadowRoots(mutations: MutationRecord[]): boolean;
  checkForNewShadowRoots(addedElements?: Element[], unresolvedHostSink?: Set<Element>): boolean;
  resetObservedShadowRoots(): void;
  purgeDetachedShadowRoots(): void;
  queryDeepSelector(selector: string): Element | null;
  findIframeCrossing(
    selector: string,
  ): { iframeElement: HTMLIFrameElement; innerSelector: string } | null;
}
