import { ToastService } from "@bitwarden/components";

import { AutomationCapability } from "../automation-capability";

const TOAST_TITLE = "Automation WebAuthn";

/** A WebAuthn request the automation WebAuthn client holds, e.g. `{ id: "1", rpId: "localhost" }`. */
export type AutomationWebAuthnRequestInfo = { id: string; rpId: string };

/**
 * Controls the desktop main-process automation WebAuthn client from the renderer. Kept generic,
 * like the biometrics controller, so this file has no dependency on desktop code; the desktop
 * client supplies an implementation that forwards to the main process over IPC.
 *
 * Requests and responses carry bytes as base64url.
 */
export interface AutomationWebAuthnController {
  /** Lists the assertion requests waiting for an answer. */
  listPending(): Promise<unknown[]>;
  /** Answers the request with `id` with an assertion. Returns whether it was waiting. */
  respond(id: string, response: unknown): Promise<boolean>;
  /** Fails the request with `id` with a `DOMException` name. Returns whether it was waiting. */
  reject(id: string, error: { name: string; message: string }): Promise<boolean>;
  /** Calls `callback` for each request as it starts waiting. */
  onRequest(callback: (request: AutomationWebAuthnRequestInfo) => void): void;
}

/**
 * Answers WebAuthn requests in place of the platform's passkey APIs. Desktop only.
 * Toasts each request and its answer, since no prompt shows them.
 */
export class WebAuthnCapability extends AutomationCapability {
  readonly automationName = "webauthn";

  constructor(
    private controller: AutomationWebAuthnController,
    private toastService: ToastService,
  ) {
    super();

    this.controller.onRequest((request) =>
      this.toast("info", `Pending WebAuthn request ${request.id} for ${request.rpId}`),
    );
  }

  async listPending(): Promise<unknown[]> {
    return await this.controller.listPending();
  }

  async respond(id: string, response: unknown): Promise<boolean> {
    const answered = await this.controller.respond(id, response);
    if (answered) {
      this.toast("success", `Answered WebAuthn request ${id}`);
    }
    return answered;
  }

  async reject(id: string, error: { name: string; message: string }): Promise<boolean> {
    const rejected = await this.controller.reject(id, error);
    if (rejected) {
      this.toast("warning", `Failed WebAuthn request ${id} with ${error.name}`);
    }
    return rejected;
  }

  private toast(variant: "info" | "success" | "warning", message: string) {
    this.toastService.showToast({ variant, title: TOAST_TITLE, message });
  }
}
