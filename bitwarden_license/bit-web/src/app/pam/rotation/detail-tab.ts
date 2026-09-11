/** The tab a URL segment names, drawn from the page's own list of tabs. */
export function tabFromSegment<TTab extends string>(
  segment: string | null | undefined,
  tabs: readonly [TTab, ...TTab[]],
): TTab {
  return tabs.find((tab) => tab === segment) ?? tabs[0];
}
