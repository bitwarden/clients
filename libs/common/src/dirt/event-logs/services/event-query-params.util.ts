/**
 * Appends the `start` / `end` / `continuationToken` query parameters shared by every event-log
 * endpoint to a base path. Shared between {@link EventLogApiService} and the deprecated monolithic
 * `ApiService` so the parameter logic has a single source of truth as the remaining `getEvents*`
 * calls migrate out per ADR-0005.
 */
export function addEventParameters(
  base: string,
  start: string,
  end: string,
  token: string,
): string {
  if (start != null) {
    base += "?start=" + start;
  }
  if (end != null) {
    base += base.indexOf("?") > -1 ? "&" : "?";
    base += "end=" + end;
  }
  if (token != null) {
    base += base.indexOf("?") > -1 ? "&" : "?";
    base += "continuationToken=" + token;
  }
  return base;
}
