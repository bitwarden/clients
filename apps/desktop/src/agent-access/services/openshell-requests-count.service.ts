import { Injectable, signal } from "@angular/core";

/**
 * How many agent permission requests are waiting, per sandbox, so the sandbox page can badge its
 * "Requests" tab without owning the list. The tab reports what it reads; the page reads it once
 * when a sandbox opens. A count is a number only: no request text is kept here.
 */
@Injectable({ providedIn: "root" })
export class OpenShellRequestsCountService {
  private readonly counts = signal<Readonly<Record<string, number>>>({});

  /** Pending requests last seen for `sandboxName`; 0 when unknown. */
  pendingFor(sandboxName: string | null | undefined): number {
    return sandboxName == null ? 0 : (this.counts()[sandboxName] ?? 0);
  }

  set(sandboxName: string, pending: number): void {
    if (this.counts()[sandboxName] !== pending) {
      this.counts.set({ ...this.counts(), [sandboxName]: pending });
    }
  }

  /** One read of the pending requests; failures leave the last count alone. */
  async refresh(sandboxName: string | null | undefined): Promise<void> {
    if (sandboxName == null) {
      return;
    }
    try {
      const result = await ipc.agentAccess.listOpenShellRequests({
        sandboxName,
        status: "pending",
      });
      if (result.ok) {
        this.set(sandboxName, result.data.length);
      }
    } catch {
      // The badge is a convenience; the tab reports its own failures.
    }
  }
}
