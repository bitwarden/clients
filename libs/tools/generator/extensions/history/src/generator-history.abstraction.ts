// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CredentialType } from "@bitwarden/generator-core";

import { GeneratedCredential } from "./generated-credential";

/** Tracks the history of password generations.
 *  Each user gets their own store.
 */
export abstract class GeneratorHistoryService {
  /** Tracks a new credential. When an item with the same `credential` value
   *  is found, this method does nothing. When the total number of items exceeds
   *  {@link HistoryServiceOptions.maxTotal}, then the oldest items exceeding the total
   *  are deleted.
   *  @param userId identifies the user storing the credential.
   *  @param credential stored by the history service.
   *  @param date when the credential was generated. If this is omitted, then the generator
   *    uses the date the credential was added to the store instead.
   *  @returns a promise that completes with the added credential. If the credential
   *    wasn't added, then the promise completes with `null`.
   *  @remarks this service is not suitable for use with vault items/ciphers. It models only
   *    a history of an individually generated credential, while a vault item's history
   *    may contain several credentials that are better modelled as atomic versions of the
   *    vault item itself.
   */
  track: (
    userId: UserId,
    credential: string,
    category: CredentialType,
    date?: Date,
  ) => Promise<GeneratedCredential | null>;

  /** Removes a matching credential from the history service.
   *  @param userId identifies the user taking the credential.
   *  @param credential to match in the history service.
   *  @returns A promise that completes with the credential read. If the credential wasn't found,
   *    the promise completes with null.
   *  @remarks this can be used to extract an entry when a credential is stored in the vault.
   */
  take: (userId: UserId, credential: string) => Promise<GeneratedCredential | null>;

  /** Deletes a user's credential history.
   *  @param userId identifies the user taking the credential.
   *  @returns A promise that completes when the history is cleared.
   */
  clear: (userId: UserId) => Promise<GeneratedCredential[]>;

  /** Lists all credentials for a user.
   *  @param userId identifies the user listing the credential.
   *  @remarks This field is eventually consistent with `track` and `take` operations.
   *    It is not guaranteed to immediately reflect those changes.
   */
  credentials$: (userId: UserId) => Observable<GeneratedCredential[]>;
}
