/**
 * Whether this renderer was reloaded rather than freshly started. Lock wipes secrets from memory
 * by crashing and reloading the renderer (see window.main.ts "reload-process").
 */
export function isProcessReload(): boolean {
  const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return navigation?.type === "reload";
}
