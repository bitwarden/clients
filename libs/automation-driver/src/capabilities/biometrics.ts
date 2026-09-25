import { ToastService } from "@bitwarden/components";

import { AutomationCapability } from "../automation-capability";

const TOAST_TITLE = "Automation biometrics";

/** A biometric request the automation biometrics service holds, e.g. `{ id: "1", type: "unlock" }`. */
export type AutomationBiometricRequestInfo = { id: string; type: string };

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
  /** Approve a pending request by id, or every pending request when no id is given. Returns the approved requests. */
  approve(id?: string): Promise<AutomationBiometricRequestInfo[]>;
  /** Deny a pending request by id, or every pending request when no id is given. Returns the denied requests. */
  deny(id?: string): Promise<AutomationBiometricRequestInfo[]>;
  /** Calls `callback` for each request as it starts awaiting approval. */
  onRequest(callback: (request: AutomationBiometricRequestInfo) => void): void;
}

/**
 * Drives mocked biometrics through a client-supplied controller. Desktop only.
 * Toasts each request and its answer, since no native prompt shows them.
 */
export class BiometricsCapability extends AutomationCapability {
  readonly automationName = "biometrics";

  constructor(
    private controller: AutomationBiometricsController,
    private toastService: ToastService,
  ) {
    super();

    this.controller.onRequest((request) =>
      this.toast("info", `Pending ${request.type} request ${request.id}`),
    );
  }

  async setStatus(status: number): Promise<void> {
    await this.controller.setStatus(status);
  }

  async listPending(): Promise<unknown[]> {
    return await this.controller.listPending();
  }

  async approve(id?: string): Promise<void> {
    const approved = await this.controller.approve(id);
    for (const request of approved) {
      this.toast("success", `Approved ${request.type} request ${request.id}`);
    }
  }

  async deny(id?: string): Promise<void> {
    const denied = await this.controller.deny(id);
    for (const request of denied) {
      this.toast("warning", `Denied ${request.type} request ${request.id}`);
    }
  }

  private toast(variant: "info" | "success" | "warning", message: string) {
    this.toastService.showToast({ variant, title: TOAST_TITLE, message });
  }
}
