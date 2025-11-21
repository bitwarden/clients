import { UrlTree } from "@angular/router";
import { Observable } from "rxjs";

/** Reactive logic for send access pages */
export abstract class SendAccessService {
  /** Redirect to a Send's authentication handler
   *  @param sendId identifies the send
   *  @returns an async observable that resolves with the redirection
   *    URL then completes.
   */
  abstract redirect$(sendId: string): Observable<UrlTree>;

  /** Set global context information; only one context can be active
   *  at a time.
   *  @param sendId identifies the send
   *  @param key the send's encoded decryption key
   *  @returns a promise that completes once the context is set
   */
  abstract setContext(sendId: string, key: string): Promise<void>;

  /** Clears the global context. */
  abstract clear(): Promise<void>;

  /** Authenticates a send with a password
   *  @param sendId identifies the send.
   *  @param password a password that authenticates the recipient
   *  @returns an observable that emits `true` if the password is correct,
   *   and `false` if the password is incorrect, and then completes.
   *   The observable errors if `sendId` does not match the global context.
   */
  abstract authenticate$(sendId: string, password: string): Observable<boolean>;
}
