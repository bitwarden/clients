import { Observable, Subject } from "rxjs";

import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";

export interface ActiveRequest {
  credentials: Fido2CredentialView[];
  subject: Subject<string>;
}

export type RequestCollection = Readonly<{ [tabId: number]: ActiveRequest }>;

export abstract class Fido2ActiveRequestManager {
  getActiveRequest$: (tabId: number) => Observable<ActiveRequest | undefined>;
  getActiveRequest: (tabId: number) => ActiveRequest | undefined;
  newActiveRequest: (
    tabId: number,
    credentials: Fido2CredentialView[],
    abortController: AbortController,
  ) => Promise<string>;
  removeActiveRequest: (tabId: number) => void;
}
