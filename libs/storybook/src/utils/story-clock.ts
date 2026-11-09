export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Fixed, so story timestamps don't drift into a visual-regression diff. */
export const STORY_NOW = new Date("2026-08-17T12:00:00.000Z");

/** An offset from {@link STORY_NOW}, for labels built by a builder that takes `now`. */
export function fromNow(ms: number): string {
  return new Date(STORY_NOW.getTime() + ms).toISOString();
}

/**
 * An offset from `Date.now()`, for surfaces that tick their own clock. Call inside a story's
 * provider factory so it stays fresh on every render, and start the clock with
 * {@link startClockAtStoryNow} so the rendered times don't drift.
 */
export function liveFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/**
 * A story `beforeEach` that moves `Date.now()` to {@link STORY_NOW}. The clock keeps running, since
 * countdowns and rxjs debounces stall on a frozen one.
 */
export function startClockAtStoryNow(): () => void {
  const realNow = Date.now;
  const offset = STORY_NOW.getTime() - realNow();
  Date.now = () => realNow() + offset;
  return () => {
    Date.now = realNow;
  };
}
