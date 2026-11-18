/** The tab a URL segment names, or the first tab when it names none. */
export function tabFromSegment<TTab extends string>(
  segment: string | null | undefined,
  tabs: readonly [TTab, ...TTab[]],
): TTab {
  return tabs.find((tab) => tab === segment) ?? tabs[0];
}
