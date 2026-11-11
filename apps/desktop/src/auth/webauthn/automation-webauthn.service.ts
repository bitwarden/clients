import { Observable, Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import type { webauthn } from "@bitwarden/desktop-napi";

import {
  AutomationWebAuthnError,
  AutomationWebAuthnRequest,
  AutomationWebAuthnResponse,
} from "./automation-webauthn-message";

/** Stands in for `webauthn.AssertionCancellation` for requests the automation client holds. */
export class AutomationWebAuthnCancellation {
  private onCancel: (() => void) | undefined;
  private cancelled = false;

  /** Ends the request with an `AbortError`, as the platform's prompt does when it's closed. */
  cancel(): void {
    this.cancelled = true;
    this.onCancel?.();
  }

  /** Calls `callback` when the request is cancelled, at once if it already was. */
  whenCancelled(callback: () => void): void {
    this.onCancel = callback;
    if (this.cancelled) {
      callback();
    }
  }
}

interface PendingRequest {
  request: AutomationWebAuthnRequest;
  resolve: (result: webauthn.GetAssertionResult) => void;
}

/**
 * A fake WebAuthn client for automation (E2E tests). It replaces the platform's passkey APIs and
 * the browser connector in the desktop main process when running in dev mode with
 * `USE_AUTOMATION_WEBAUTHN` set, so no prompt or browser opens.
 *
 * Requests wait until automation answers them with an assertion it made, e.g. with a software
 * authenticator, or fails them. It holds no keys and makes no assertions itself.
 */
export class AutomationWebAuthnService {
  private pending = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private readonly requestsSubject = new Subject<AutomationWebAuthnRequest>();

  /** Each request as it starts waiting, e.g. to show it to a person watching. */
  readonly requests$: Observable<AutomationWebAuthnRequest> = this.requestsSubject.asObservable();

  constructor(private readonly logService: LogService) {}

  /** Takes the place of `webauthn.getAssertion`: waits for automation to answer the request. */
  getAssertion(
    request: webauthn.AssertionRequest,
    cancellation: AutomationWebAuthnCancellation,
  ): Promise<webauthn.GetAssertionResult> {
    const id = (this.nextRequestId++).toString();
    const pendingRequest = toAutomationRequest(id, request);

    return new Promise((resolve) => {
      this.pending.set(id, { request: pendingRequest, resolve });
      this.logService.info("[AutomationWebAuthn] Request %s for %s is waiting", id, request.rpId);
      this.requestsSubject.next(pendingRequest);

      cancellation.whenCancelled(() =>
        this.settle(id, { error: { name: "AbortError", message: "The request was cancelled." } }),
      );
    });
  }

  listPendingRequests(): AutomationWebAuthnRequest[] {
    return [...this.pending.values()].map(({ request }) => request);
  }

  /** Answers the request with `id`. Returns whether it was waiting. */
  respond(id: string, response: AutomationWebAuthnResponse): boolean {
    return this.settle(id, { response: toAssertionResponse(response) });
  }

  /** Fails the request with `id`. Returns whether it was waiting. */
  reject(id: string, error: AutomationWebAuthnError): boolean {
    return this.settle(id, { error: { name: error.name, message: error.message } });
  }

  private settle(id: string, result: webauthn.GetAssertionResult): boolean {
    const pendingRequest = this.pending.get(id);
    if (pendingRequest == null) {
      return false;
    }
    this.pending.delete(id);
    this.logService.info(
      "[AutomationWebAuthn] Request %s %s",
      id,
      result.error == null ? "answered" : `failed with ${result.error.name}`,
    );
    pendingRequest.resolve(result);
    return true;
  }
}

function toB64(bytes: Uint8Array): string {
  return Utils.fromB64toUrlB64(Utils.fromBufferToB64(bytes));
}

function fromB64(value: string): Uint8Array {
  return Utils.fromUrlB64ToArray(value);
}

function toAutomationRequest(
  id: string,
  request: webauthn.AssertionRequest,
): AutomationWebAuthnRequest {
  return {
    id,
    origin: request.origin,
    rpId: request.rpId,
    challenge: toB64(request.challenge),
    allowCredentials: request.allowCredentials.map((c) => ({
      id: toB64(c.id),
      transports: c.transports,
    })),
    userVerification: request.userVerification,
    timeout: request.timeout,
    prf:
      request.prf == null
        ? undefined
        : {
            first: toB64(request.prf.first),
            second: request.prf.second == null ? undefined : toB64(request.prf.second),
          },
    appId: request.appId,
  };
}

function toAssertionResponse(response: AutomationWebAuthnResponse): webauthn.AssertionResponse {
  return {
    credentialId: fromB64(response.credentialId),
    clientDataJson: fromB64(response.clientDataJson),
    authenticatorData: fromB64(response.authenticatorData),
    signature: fromB64(response.signature),
    userHandle: response.userHandle == null ? undefined : fromB64(response.userHandle),
    authenticatorAttachment: response.authenticatorAttachment,
    prf:
      response.prf == null
        ? undefined
        : {
            first: fromB64(response.prf.first),
            second: response.prf.second == null ? undefined : fromB64(response.prf.second),
          },
    appIdUsed: response.appIdUsed,
  };
}
