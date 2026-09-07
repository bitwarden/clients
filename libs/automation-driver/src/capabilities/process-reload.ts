import { AutomationCapability } from "../automation-capability";

/**
 * Client-supplied process reload controls. Reloading restarts the client, so a client that can
 * also suppress reloads lets an automated run keep the pages it is driving alive.
 */
export interface AutomationProcessReloadController {
  reload(): Promise<void> | void;
  /** Only clients that can suppress their own reloads implement this. */
  setEnabled?(enabled: boolean): Promise<void> | void;
}

/** Reloads the client process, or turns reloads off. */
export class ProcessReloadCapability extends AutomationCapability {
  readonly automationName = "processReload";

  constructor(private controller: AutomationProcessReloadController) {
    super();
  }

  async reload(): Promise<void> {
    await this.controller.reload();
  }

  /**
   * Stops the client reloading itself. A reload restarts the client and invalidates every page an
   * automated run is driving, which a run cannot recover from mid-flow.
   */
  async disable(): Promise<void> {
    await this.setEnabled(false);
  }

  async enable(): Promise<void> {
    await this.setEnabled(true);
  }

  private async setEnabled(enabled: boolean): Promise<void> {
    if (!this.controller.setEnabled) {
      throw new Error("this client cannot suppress its process reloads");
    }

    await this.controller.setEnabled(enabled);
  }
}
