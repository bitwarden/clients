import { Observable, Subject } from "rxjs";

import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";

export const Fido2ActiveRequestEvents = {
  Refresh: "refresh-fido2-active-request",
  Abort: "abort-fido2-active-request",
  Continue: "continue-fido2-active-request",
} as const;

type Fido2ActiveRequestEvent = typeof Fido2ActiveRequestEvents;

export type RequestResult =
  | { type: Fido2ActiveRequestEvent["Refresh"] }
  | { type: Fido2ActiveRequestEvent["Abort"] }
  | { type: Fido2ActiveRequestEvent["Continue"]; credentialId: string };

export interface ActiveRequest {
  credentials: Fido2CredentialView[];
  subject: Subject<RequestResult>;
}

export type RequestCollection = Readonly<{ [tabId: number]: ActiveRequest }>;

export abstract class Fido2ActiveRequestManager {
  abstract getActiveRequest$(tabId: number): Observable<ActiveRequest | undefined>;
  abstract getActiveRequest(tabId: number): ActiveRequest | undefined;
  abstract newActiveRequest(
    tabId: number,
    credentials: Fido2CredentialView[],
    abortController: AbortController,
  ): Promise<RequestResult>;
  abstract removeActiveRequest(tabId: number): void;
  abstract removeAllActiveRequests(): void;
}
