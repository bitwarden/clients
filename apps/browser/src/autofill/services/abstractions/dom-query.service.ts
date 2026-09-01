export interface DomQueryService {
  query<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    treeWalkerFilter: CallableFunction,
    mutationObserver?: MutationObserver,
    forceDeepQueryAttempt?: boolean,
  ): T[];
  updatePageContainsShadowDom(): boolean;
  checkMutationsInShadowRoots(mutations: MutationRecord[]): boolean;
  checkForNewShadowRoots(addedElements?: Element[]): boolean;
  resetObservedShadowRoots(): void;
  purgeDetachedShadowRoots(): void;
  queryDeepSelector(selector: string): Element | null;
  findIframeCrossing(
    selector: string,
  ): { iframeElement: HTMLIFrameElement; innerSelector: string } | null;
}
