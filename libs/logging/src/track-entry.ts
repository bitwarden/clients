/**
 * Records a performance entry on a custom DevTools track, e.g. under
 * Performance > "KeyManagement" > "LegacyCrypto".
 *
 * @param name Name of the entry shown in DevTools.
 * @param start Start time of the entry, from `performance.now()`.
 * @param trackGroup Group the track is nested under, generally the owning team.
 * @param track Track the entry is shown on, generally the class name.
 * @param properties Additional properties shown when selecting the entry.
 */
export function recordTrackEntry(
  name: string,
  start: DOMHighResTimeStamp,
  trackGroup: string,
  track: string,
  properties?: [string, any][],
): PerformanceMeasure {
  return performance.measure(name, {
    start,
    detail: {
      devtools: {
        dataType: "track-entry",
        track,
        trackGroup,
        properties,
      },
    },
  });
}
