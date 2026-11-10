import { NgZone } from "@angular/core";

const FIRST_DELAY_MS = 10_000;
const MAX_DELAY_MS = 120_000;

/** Reads per run, about ten minutes of a job at {@link activeJobPollDelay}'s pace. */
export const ACTIVE_JOB_MAX_READS = 8;

/** The wait before a run's nth read (0-based): 10s, doubling to at most 2 minutes. */
export function activeJobPollDelay(read: number): number {
  return Math.min(FIRST_DELAY_MS * 2 ** read, MAX_DELAY_MS);
}

/**
 * Re-reads rotation state while a job runs, since a running job finishes on the server with
 * nothing pushed to the client. A run ends when `read` reports no running job, after
 * {@link ACTIVE_JOB_MAX_READS} reads, on the first failed read, or on {@link stop}. The timer runs
 * outside the Angular zone, since an in-zone timer would hang `whenStable()`.
 */
export class ActiveJobPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run = 0;
  private reads = 0;

  /** `read` re-reads and applies the state, and resolves whether a job is still running. */
  constructor(
    private readonly zone: NgZone,
    private readonly read: () => Promise<boolean>,
  ) {}

  /** Starts a fresh run, replacing the current one. */
  start(): void {
    this.stop();
    this.reads = 0;
    this.schedule(this.run);
  }

  /** Ends the current run; a read already in flight is ignored when it lands. */
  stop(): void {
    this.run++;
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(run: number): void {
    if (this.reads >= ACTIVE_JOB_MAX_READS) {
      return;
    }
    const delay = activeJobPollDelay(this.reads);
    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => void this.tick(run), delay);
    });
  }

  private async tick(run: number): Promise<void> {
    this.timer = null;
    this.reads++;
    let running: boolean;
    try {
      running = await this.read();
    } catch {
      return;
    }
    if (run === this.run && running) {
      this.schedule(run);
    }
  }
}
