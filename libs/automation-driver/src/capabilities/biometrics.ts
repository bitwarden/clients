import { AutomationCapability } from "../automation-capability";

/**
 * Controls the desktop main-process automation biometrics service from the renderer. Kept generic
 * so this (common) file has no dependency on desktop code; the desktop client supplies an
 * implementation that forwards to the main process over IPC.
 */
export interface AutomationBiometricsController {
  /** Set the mocked {@link BiometricsStatus} the automation biometrics service reports. */
  setStatus(status: number): Promise<void>;
  /** List the biometric requests currently awaiting approval. */
  listPending(): Promise<unknown[]>;
  /** Approve a pending request by id, or the oldest pending request when no id is given. */
  approve(id?: string): Promise<void>;
  /** Deny a pending request by id, or the oldest pending request when no id is given. */
  deny(id?: string): Promise<void>;
}

/** Drives mocked biometrics through a client-supplied controller. Desktop only. */
export class BiometricsCapability extends AutomationCapability {
  readonly automationName = "biometrics";

  constructor(private controller: AutomationBiometricsController) {
    super();
  }

  async setStatus(status: number): Promise<void> {
    await this.controller.setStatus(status);
  }

  async listPending(): Promise<unknown[]> {
    return await this.controller.listPending();
  }

  async approve(id?: string): Promise<void> {
    await this.controller.approve(id);
  }

  async deny(id?: string): Promise<void> {
    await this.controller.deny(id);
  }
}
