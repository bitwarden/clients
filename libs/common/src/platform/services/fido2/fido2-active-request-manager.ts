import {
  BehaviorSubject,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  startWith,
  Subject,
} from "rxjs";

import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import {
  ActiveRequest,
  RequestCollection,
  Fido2ActiveRequestManager as Fido2ActiveRequestManagerAbstraction,
  Fido2ActiveRequestEvents,
  RequestResult,
} from "../../abstractions/fido2/fido2-active-request-manager.abstraction";

export class Fido2ActiveRequestManager implements Fido2ActiveRequestManagerAbstraction {
  private activeRequests$: BehaviorSubject<RequestCollection> = new BehaviorSubject({});

  /**
   * Gets the observable stream of all active requests associated with a given tab id.
   *
   * @param tabId - The tab id to get the active request for.
   */
  getActiveRequest$(tabId: number): Observable<ActiveRequest | undefined> {
    return this.activeRequests$.pipe(
      map((requests) => requests[tabId]),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
      startWith(undefined),
    );
  }

  /**
   * Gets the active request associated with a given tab id.
   *
   * @param tabId - The tab id to get the active request for.
   */
  getActiveRequest(tabId: number): ActiveRequest | undefined {
    return this.activeRequests$.value[tabId];
  }

  /**
   * Creates a new active fido2 request.
   *
   * @param tabId - The tab id to associate the request with.
   * @param credentials - The credentials to use for the request.
   * @param abortController - The abort controller to use for the request.
   */
  async newActiveRequest(
    tabId: number,
    credentials: Fido2CredentialView[],
    abortController: AbortController,
  ): Promise<RequestResult> {
    const newRequest: ActiveRequest = {
      credentials,
      subject: new Subject(),
    };
    this.updateRequests((existingRequests) => ({
      ...existingRequests,
      [tabId]: newRequest,
    }));

    const abortListener = () => this.abortActiveRequest(tabId);
    abortController.signal.addEventListener("abort", abortListener);
    const requestResult = firstValueFrom(newRequest.subject);
    abortController.signal.removeEventListener("abort", abortListener);

    return requestResult;
  }

  /**
   * Removes and aborts the active request associated with a given tab id.
   *
   * @param tabId - The tab id to abort the active request for.
   */
  removeActiveRequest(tabId: number) {
    this.abortActiveRequest(tabId);
    this.updateRequests((existingRequests) => {
      const newRequests = { ...existingRequests };
      delete newRequests[tabId];
      return newRequests;
    });
  }

  /**
   * Removes and aborts all active requests.
   */
  removeAllActiveRequests() {
    Object.keys(this.activeRequests$.value).forEach((tabId) => {
      this.abortActiveRequest(Number(tabId));
    });
    this.updateRequests(() => ({}));
  }

  /**
   * Aborts the active request associated with a given tab id.
   *
   * @param tabId - The tab id to abort the active request for.
   */
  private abortActiveRequest(tabId: number): void {
    this.activeRequests$.value[tabId]?.subject.next({ type: Fido2ActiveRequestEvents.Abort });
    this.activeRequests$.value[tabId]?.subject.error(
      new DOMException("The operation either timed out or was not allowed.", "AbortError"),
    );
  }

  /**
   * Updates the active requests.
   *
   * @param updateFunction - The function to use to update the active requests.
   */
  private updateRequests(
    updateFunction: (existingRequests: RequestCollection) => RequestCollection,
  ) {
    this.activeRequests$.next(updateFunction(this.activeRequests$.value));
  }
}
