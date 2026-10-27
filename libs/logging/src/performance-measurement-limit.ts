/** About 10 MB, at the ~1 KB for each entry that was measured in Chromium. */
export const MAX_ENTRIES = 10_000;

/**
 * Clears all performance marks and measures when there are more than {@link MAX_ENTRIES} entries.
 *
 * Marks and measures are recorded whether DevTools is open or not, and nothing clears them.
 *
 * Clearing by name gives almost the same result, because it removes all entries with that name, and
 * a small number of names hold almost all entries.
 *
 * @returns Stops the limit when disposed.
 */
export function limitPerformanceMeasurements(): Disposable {
  // Some environments lack the User Timing API, e.g. jsdom
  if (
    typeof PerformanceObserver === "undefined" ||
    typeof performance?.clearMarks !== "function" ||
    typeof performance?.clearMeasures !== "function"
  ) {
    return { [Symbol.dispose]: () => {} };
  }

  let count = 0;
  const observer = new PerformanceObserver((list) => {
    count += list.getEntries().length;
    if (count > MAX_ENTRIES) {
      performance.clearMarks();
      performance.clearMeasures();
      count = 0;
    }
  });
  // `buffered` also counts entries recorded before the limit was installed
  observer.observe({ type: "mark", buffered: true });
  observer.observe({ type: "measure", buffered: true });
  return { [Symbol.dispose]: () => observer.disconnect() };
}
