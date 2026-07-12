import { SendAccessToken } from "../../../auth/send-access";
import { ListResponse } from "../../../models/response/list.response";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";

export abstract class SendApiService {
  abstract getSend(id: string): Promise<SendResponse>;
  abstract postSendAccess(
    id: string,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract postSendAccessV2(
    accessToken: SendAccessToken,
    apiUrl?: string,
  ): Promise<SendAccessResponse>;
  abstract getSends(): Promise<ListResponse<SendResponse>>;
  abstract putSendRemovePassword(id: string): Promise<SendResponse>;
  abstract deleteSend(id: string): Promise<any>;
  abstract getSendFileDownloadData(
    send: SendAccessView,
    request: SendAccessRequest,
    apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse>;
  abstract getSendFileDownloadDataV2(
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
}
