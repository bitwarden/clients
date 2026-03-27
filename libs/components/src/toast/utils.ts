/** A one-shot timer that supports pausing and resuming while preserving remaining time. */
export class PausableTimer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private remaining: number;
  private startedAt = 0;
  private cancelled = false;

  constructor(
    private readonly callback: () => void,
    duration: number,
  ) {
    this.remaining = duration;
    this.start();
  }

  /** Pauses the timer, preserving the remaining duration. No-op if already paused. */
  pause(): void {
    if (this.timeoutId === null) {
      return;
    }
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
  }

  /** Resumes the timer from where it was paused. No-op if already running or cancelled. */
  resume(): void {
    if (this.cancelled || this.timeoutId !== null) {
      return;
    }
    this.start();
  }

  /** Cancels the timer permanently. The callback will not fire. */
  cancel(): void {
    this.cancelled = true;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private start(): void {
    this.startedAt = Date.now();
    this.timeoutId = setTimeout(this.callback, this.remaining);
  }
}

/**
 * Given a toast message, calculate the ideal timeout length following:
 * a minimum of `baseTimeout` + 1 extra second per 120 additional words
 *
 * @param message the toast message to be displayed
 * @param baseTimeout the base timeout in milliseconds (defaults to 5000)
 * @returns the timeout length in milliseconds
 */
export const calculateToastTimeout = (message: string | string[], baseTimeout = 5000): number => {
  const paragraphs = Array.isArray(message) ? message : [message];
  const numWords = paragraphs
    .map((paragraph) => paragraph.split(/\s+/).filter((word) => word !== ""))
    .flat().length;
  return baseTimeout + Math.floor(numWords / 120) * 1000;
};
