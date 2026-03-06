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
  checkForNewShadowRoots(): boolean;
  resetObservedShadowRoots(): void;
}
