import { Injectable, signal } from "@angular/core";

/**
 * How many port forwards each sandbox has, so the sandbox page's "Ports" tab can show a count that
 * the tab itself keeps current. Numbers only, in renderer memory; never persisted.
 */
@Injectable({ providedIn: "root" })
export class AgentAccessOpenShellPortsCountService {
  private readonly counts = signal<Readonly<Record<string, number>>>({});

  /** The last known count for a sandbox, or `null` when it hasn't been read yet. */
  countFor(sandboxName: string | null | undefined): number | null {
    return sandboxName == null ? null : (this.counts()[sandboxName] ?? null);
  }

  set(sandboxName: string, count: number): void {
    if (this.counts()[sandboxName] !== count) {
      this.counts.update((current) => ({ ...current, [sandboxName]: count }));
    }
  }
}
