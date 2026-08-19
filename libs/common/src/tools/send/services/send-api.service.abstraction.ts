// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";

import { SendAccessToken } from "../../../auth/send-access";
import { ListResponse } from "../../../models/response/list.response";
import { Send } from "../models/domain/send";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";

export abstract class SendApiService {
  abstract getSend(id: string): Promise<SendResponse>;
  abstract postSendAccess(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract getSends(): Promise<ListResponse<SendResponse>>;
  abstract putSendRemovePassword(id: string): Promise<SendResponse>;
  abstract deleteSend(id: string): Promise<any>;
  abstract getSendFileDownloadData(
    send: SendAccessView,
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse>;
  abstract removePassword(id: string): Promise<any>;
  abstract delete(id: string): Promise<any>;
  /**
   * Persists a send.
   *
   * @param sendData The encrypted send and (for file sends) its encrypted file buffer.
   * @param plaintextPassword The plaintext password the caller collected for this save, when the
   *   user set or changed the password. `SendService.encrypt` consumes the plaintext to derive the
   *   proof-of-knowledge `keyB64` on the domain `Send`, but does not retain the plaintext; the SDK
   *   path needs it to derive that proof over the key it generates, so callers forward it here.
   *   `undefined`/`null` means "no password change" — on an edit that preserves an existing
   *   password. Protected Data: implementations must never log it or place it in error messages.
   *   The legacy implementation ignores it (its behavior is unchanged).
   */
  abstract save(sendData: [Send, EncArrayBuffer], plaintextPassword?: string): Promise<Send>;
  /**
   * Persists a send from its plaintext view, letting the implementation own encryption.
   *
   * Prefer this over {@link save} for new code. `save` requires the caller to encrypt first,
   * which the SDK path cannot use: the SDK generates the send key itself, so a client-encrypted
   * payload has to be decrypted straight back to plaintext (and a pre-encrypted file buffer is
   * unusable outright, since its key would never match the one the SDK generates). Handing over
   * the plaintext view lets each implementation encrypt exactly once, where it can:
   * - legacy encrypts client-side via `SendService.encrypt`, then posts the wire form.
   * - the SDK path forwards the view to the SDK, which encrypts under its own generated key.
   *
   * @param view The plaintext send to persist. A `null` `id` creates; otherwise edits.
   * @param file The plaintext file bytes for a file send create, or `null`. Ignored on edit —
   *   file contents are immutable after create.
   * @param plaintextPassword The plaintext password the caller collected for this save, when the
   *   user set or changed the password. `undefined`/`null` means "no password change".
   *   Protected Data: implementations must never log it or place it in error messages.
   * @returns The persisted send in its wire-encrypted form, as stored in local state.
   */
  abstract saveView(
    view: SendView,
    file: File | ArrayBuffer | null,
    plaintextPassword?: string,
  ): Promise<Send>;
}
