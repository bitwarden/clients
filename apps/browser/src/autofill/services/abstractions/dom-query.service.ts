export interface DomQueryService {
  query<T>(
    root: Document | ShadowRoot | Element,
    queryString: string,
    treeWalkerFilter: CallableFunction,
    mutationObserver?: MutationObserver,
    forceDeepQueryAttempt?: boolean,
  ): T[];
  queryDeepSelector(root: Document | ShadowRoot | Element, selector: string): Element[];
  checkPageContainsShadowDom(): boolean;
}
