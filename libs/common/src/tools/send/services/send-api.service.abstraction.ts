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
   * @deprecated Prefer {@link saveView}: this method requires the caller to pre-encrypt, which
   *   the SDK path can't use (see {@link saveView}'s doc comment for why). The only remaining
   *   caller, `AddEditComponent` in `libs/angular/src/tools/send`, does not appear to be routed
   *   in any app — worth confirming before relying on that, but it suggests this can likely be
   *   removed outright rather than just deprecated.
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
   * the plaintext view lets each implementation encrypt exactly once, where it can. Both generate
   * their own send key and encrypt in-process — "client-side" isn't what distinguishes them,
   * owning key generation is:
   * - legacy generates the key and encrypts in this TypeScript code, via `SendService.encrypt`.
   * - the SDK path forwards the view into the SDK, which generates the key and encrypts inside
   *   its own WASM boundary — this TypeScript code never sees the key or the ciphertext.
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
