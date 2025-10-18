import { Observable, fromEvent, startWith, map } from "rxjs";

/**
 * Utility to create an observable that emits when a media query match changes
 * @param query Media query string
 * @returns Observable that emits a boolean indicating if the media query matches
 */
export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
