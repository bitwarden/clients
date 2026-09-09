import { catchError, firstValueFrom, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";
import {
  AuthEdit,
  PasswordManagerClient,
  SendAddRequest,
  SendAuthType,
  SendClient,
  SendEditRequest,
  SendId as SdkSendId,
  SendView as SdkSendView,
  SendViewType,
} from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { getUserId } from "../../../auth/services/account.service";
import { ListResponse } from "../../../models/response/list.response";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService, asUuid } from "../../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { Send } from "../models/domain/send";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendFileDownloadDataResponse } from "../models/response/send-file-download-data.response";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "./send-api.service.abstraction";
import { SendDecryptionService } from "./send-decryption.service";
import { InternalSendService } from "./send.service.abstraction";

/**
 * Ceiling on plaintext size for a file send created through {@link SendSdkApiService.createFileSend}.
 *
 * `create_file_send`'s response now carries the ciphertext as a `Uint8Array` (PM-41234 fixed the
 * `Tsify`/`Vec<u8>` gap that previously made it a plain JS `number[]`), so the original
 * several-times-byte-length JS-heap overhead this limit was sized against no longer applies.
 * Left in place pending a decision on whether some cap is still warranted for other reasons
 * (e.g. server upload limits, plaintext buffer + wasm linear memory copies).
 */
export const MAX_SDK_FILE_SEND_SIZE_BYTES = 500 * 1024 * 1024;

/**
 * SDK-backed implementation of `SendApiService`. Save/removePassword mutate via the SDK
 * then refetch via legacy to keep `InternalSendService` populated with `EncString`-shaped
 * data. Methods returning wire-encrypted shapes have no SDK equivalent and are routed to
 * legacy by `SendApiServiceSelector`; the throw-stubs here guard direct callers.
 */
export class SendSdkApiService implements SendApiServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private legacySendApiService: SendApiService,
    private sendService: InternalSendService,
    private accountService: AccountService,
    private logService: LogService,
    private sendDecryptionService: SendDecryptionService,
  ) {}

  /**
   * Saves a send via the SDK. After the mutation, refetches the wire-encrypted form via
   * the legacy service to keep `InternalSendService` populated with `EncString`-shaped
   * data. Patches the input with server-assigned id/accessId on create so callers reading
   * those after `save()` continue to work.
   *
   * New file sends cannot be handled through this method and are routed to legacy by
   * `SendApiServiceSelector`; it rejects them as a guard for direct callers:
   * `SendService.encrypt` produces a pre-encrypted buffer under a client-derived key,
   * while the SDK's `create_file_send` generates its own key. {@link saveView} carries the
   * plaintext file contents instead, and is the entry point that can create file sends
   * through the SDK.
   *
   * Password-protected sends route through the SDK. On create or password-change the caller
   * forwards the plaintext `password`, which `buildSendAuth` hands to the SDK's high-level
   * `password` auth variant so the SDK derives the proof-of-knowledge over the key it
   * generates (keeping password and key consistent). On an edit that preserves the existing
   * password the caller has no plaintext; `buildSendAuthEdit` emits `AuthEdit::Preserve`,
   * which the SDK resolves against its own stored Send, so the client never needs to know
   * or resend the existing password hash. The plaintext password is Protected Data and is
   * never logged.
   */
  async save(sendData: [Send, EncArrayBuffer], plaintextPassword?: string): Promise<Send> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const [send] = sendData;
    if (send.id == null && send.type === SendType.File) {
      throw new Error("SendSdkApiService.save: file send creation requires SendApiService.");
    }
    const sendView = await this.sendDecryptionService.decryptSend(send, userId);
    const sdkView = await this.mutateSend(sendView, userId, plaintextPassword);

    // Patch server-assigned identifiers onto the input for callers that read them after
    // save (matches the legacy SendApiService contract). The server always returns id
    // and accessId on a successful create.
    const sendId = sdkView.id as unknown as string;
    if (send.id == null) {
      send.id = sendId;
      send.accessId = sdkView.accessId as unknown as string;
    }

    try {
      return await this.refreshSendFromServer(sendId);
    } catch (error) {
      // The SDK mutation already landed on the server; only the encrypted-form refetch
      // failed. Surfacing this as a save error would prompt the user to retry, which on
      // a new send would duplicate it server-side. Log and return the caller's input
      // Send — its EncString fields are still valid (the caller encrypted them moments
      // ago), so decryption in post-save paths works. InternalSendService reconciles on
      // the next sync.
      this.logService.error(`Send refresh failed after successful mutation: ${error}`);
      return send;
    }
  }

  /**
   * Saves a send from its plaintext view — the preferred entry point for this service.
   *
   * The plaintext view goes straight into the SDK, which generates the send key and encrypts
   * under it inside its own WASM boundary — this TypeScript code never sees the key or the
   * ciphertext-generation step. (The SDK still runs in-process like the legacy TS path does;
   * "client-side" isn't what distinguishes the two — owning key generation is.) This is what
   * {@link save} cannot do, since it receives a payload already encrypted under a key the SDK
   * will never use.
   *
   * New file sends take the two-step {@link createFileSend} path instead of the single
   * `create`/`edit` call every other send uses; the result is the same plaintext view either way.
   *
   * The plaintext password is Protected Data and is never logged. See {@link buildSendAuth} and
   * {@link buildSendAuthEdit} for how it reaches the SDK.
   *
   * @param file The plaintext file contents, required when creating a file send. Ignored
   *   otherwise: file contents are immutable after create.
   */
  async saveView(
    view: SendView,
    file: File | ArrayBuffer | null,
    plaintextPassword?: string,
  ): Promise<Send> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const sdkView =
      view.id == null && view.type === SendType.File
        ? await this.createFileSend(view, file, userId, plaintextPassword)
        : await this.mutateSend(view, userId, plaintextPassword);

    return await this.refreshAfterMutation(sdkView.id as unknown as string);
  }

  async delete(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().delete(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete send: ${error}`);
          throw error;
        }),
      ),
    );
    await this.sendService.delete(id);
  }

  // Removes all auth (password or email OTP) from the send. Matches the legacy SendApiService
  // path exactly.
  async removePassword(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().remove_password(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to remove send auth: ${error}`);
          throw error;
        }),
      ),
    );
    await this.refreshSendFromServer(id);
  }

  /**
   * Not supported via SDK — returns wire-encrypted `SendResponse`, which the SDK cannot
   * produce. `SendApiServiceSelector` routes calls to `SendApiService`; this stub catches
   * direct callers that bypass the selector.
   */
  getSend(_id: string): Promise<SendResponse> {
    return Promise.reject(new Error("SendSdkApiService.getSend: use SendApiService."));
  }

  /**
   * `apiUrl` is part of the shared `SendApiService` contract for cross-instance receive (the CLI
   * opening a Send hosted on another Bitwarden instance) — legacy honours it, but
   * `SendApiServiceSelector` always routes those calls to legacy regardless of the flag, since the
   * SDK client only targets its own configured environment. It never reaches here.
   */
  async postSendAccess(
    accessToken: SendAccessToken,
    _apiUrl?: string,
  ): Promise<SendAccessResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const view = await sdk.sends().access_send(accessToken.token);
    return new SendAccessResponse(view);
  }

  /**
   * Not supported via SDK — returns wire-encrypted `ListResponse<SendResponse>`, which
   * the SDK cannot produce. `SendApiServiceSelector` routes calls to `SendApiService`;
   * this stub catches direct callers that bypass the selector.
   */
  getSends(): Promise<ListResponse<SendResponse>> {
    return Promise.reject(new Error("SendSdkApiService.getSends: use SendApiService."));
  }

  /**
   * Not supported via SDK — returns wire-encrypted `SendResponse`, which the SDK cannot
   * produce. `SendApiServiceSelector` routes calls to `SendApiService`; this stub catches
   * direct callers that bypass the selector.
   */
  putSendRemovePassword(_id: string): Promise<SendResponse> {
    return Promise.reject(
      new Error("SendSdkApiService.putSendRemovePassword: use SendApiService."),
    );
  }

  async deleteSend(id: string): Promise<any> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value.sends().delete(asUuid<SdkSendId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  /** See {@link postSendAccess} — `apiUrl` never reaches here either. */
  async getSendFileDownloadData(
    send: SendAccessView,
    accessToken: SendAccessToken,
    _apiUrl?: string,
  ): Promise<SendFileDownloadDataResponse> {
    const sdk: PasswordManagerClient = await firstValueFrom(this.sdkService.client$);
    const data = await sdk.sends().get_file_download_data(accessToken.token, send.file.id);
    return new SendFileDownloadDataResponse(data);
  }

  private async mutateSend(
    sendView: SendView,
    userId: UserId,
    plaintextPassword?: string,
  ): Promise<SdkSendView> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          if (sendView.id == null) {
            return await sendsClient.create(this.buildSendAddRequest(sendView, plaintextPassword));
          }
          return await sendsClient.edit(
            asUuid<SdkSendId>(sendView.id),
            this.buildSendEditRequest(sendView, plaintextPassword),
          );
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to upload send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  /**
   * Creates a file send through the SDK's two-step create → upload sequence.
   *
   * `create_file_send` takes the *plaintext* bytes and encrypts them internally under the send
   * key it generates, returning the ciphertext alongside the upload metadata — nothing is
   * encrypted here, and no key material is ever exposed to this service. The returned
   * ciphertext then goes straight to `upload_send_file`.
   *
   * @param file The plaintext file contents. Required: the create step needs them to size the
   *   upload the server reserves quota for.
   */
  private async createFileSend(
    view: SendView,
    file: File | ArrayBuffer | null,
    userId: UserId,
    plaintextPassword?: string,
  ): Promise<SdkSendView> {
    if (file == null) {
      throw new Error("File send creation requires file data.");
    }
    const fileSize = file instanceof ArrayBuffer ? file.byteLength : file.size;
    if (fileSize > MAX_SDK_FILE_SEND_SIZE_BYTES) {
      throw new Error(
        `File is too large to send (max ${MAX_SDK_FILE_SEND_SIZE_BYTES / (1024 * 1024)} MB).`,
      );
    }
    const fileBytes =
      file instanceof ArrayBuffer ? new Uint8Array(file) : new Uint8Array(await file.arrayBuffer());
    // A real `File` (web/browser/desktop) carries its own name; the CLI hands over plaintext
    // bytes as an `ArrayBuffer` instead and sets the name on the view itself beforehand — the
    // same split the legacy path's `SendService.encrypt` makes.
    const fileName = file instanceof ArrayBuffer ? view.file?.fileName : file.name;

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          const sendsClient = ref.value.sends();
          const created = await sendsClient.create_file_send(
            this.buildSendAddRequest(view, plaintextPassword, fileName),
            fileBytes,
          );

          const sendId = created.send.id;
          if (sendId == null) {
            throw new Error("Created file send is missing its id.");
          }

          const {
            encryptedFileBuffer,
            fileId,
            encryptedFileName,
            fileUploadType,
            url,
            send: sendView,
          } = created;

          try {
            await sendsClient.upload_send_file(
              sendId,
              fileId,
              encryptedFileName,
              fileUploadType,
              url,
              encryptedFileBuffer,
            );
          } catch (error) {
            await this.rollbackFileSend(sendsClient, sendId);
            throw error;
          }

          return sendView;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to create file send: ${error}`);
          throw error;
        }),
      ),
    );
  }

  /**
   * Deletes the send `create_file_send` registered when the upload of its contents fails.
   * Without this the server keeps a permanent, content-less send.
   *
   * A rollback failure is logged rather than thrown, so the caller still sees the upload error
   * that caused it — mirroring `SendApiService.generateRollbackCallback`, which the legacy
   * upload path hands to `FileUploadService` for the same purpose.
   */
  private async rollbackFileSend(sendsClient: SendClient, sendId: SdkSendId): Promise<void> {
    try {
      await sendsClient.delete(sendId);
    } catch (error: unknown) {
      this.logService.error(`Failed to roll back file send after a failed upload: ${error}`);
    }
  }

  /**
   * Resolves the wire-encrypted form of a send the SDK just mutated.
   *
   * Prefers a refetch from the server. If that fails the mutation has still landed, so surfacing
   * an error would invite a retry that duplicates the send; fall back to the copy the SDK wrote
   * to local state (the send repository registered in `initializeClientManagedState`), and only
   * rethrow if neither source can produce it.
   */
  private async refreshAfterMutation(sendId: string): Promise<Send> {
    try {
      return await this.refreshSendFromServer(sendId);
    } catch (error) {
      this.logService.error(`Send refresh failed after successful mutation: ${error}`);
      const local = await this.sendService.getFromState(sendId);
      if (local == null) {
        throw error;
      }
      return local;
    }
  }

  // After the SDK executes a mutation server-side, refetch the wire-encrypted form via
  // the legacy API so InternalSendService stores EncString-shaped data and consumers
  // that decrypt the returned Send work correctly.
  private async refreshSendFromServer(id: string): Promise<Send> {
    const response = await this.legacySendApiService.getSend(id);
    const data = new SendData(response);
    await this.sendService.upsert(data);
    return new Send(data);
  }

  private buildSendAddRequest(
    sendView: SendView,
    plaintextPassword?: string,
    fileName?: string,
  ): SendAddRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView, fileName),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      // A create always has a plaintext password when password-protected; there is no
      // existing key to preserve.
      auth: this.buildSendAuth(sendView, plaintextPassword),
    };
  }

  private buildSendEditRequest(sendView: SendView, plaintextPassword?: string): SendEditRequest {
    return {
      name: sendView.name,
      notes: sendView.notes ?? undefined,
      viewType: this.buildSendViewType(sendView),
      maxAccessCount: sendView.maxAccessCount ?? undefined,
      disabled: sendView.disabled,
      hideEmail: sendView.hideEmail,
      deletionDate: this.requireDeletionDate(sendView).toISOString(),
      expirationDate: sendView.expirationDate?.toISOString() ?? undefined,
      auth: this.buildSendAuthEdit(sendView, plaintextPassword),
    };
  }

  /**
   * Builds the `AuthEdit` for an edit. A password-protected send being edited without a
   * password change has no plaintext to build a `SendAuthType` from — `Preserve` tells the
   * SDK to keep whatever auth is already on the Send, resolved against its own stored state,
   * so the client never needs to know or resend the existing password hash. Every other case
   * (a password change, or a non-password auth type, which carries no secret the client could
   * be missing) can always be rebuilt from the current view and is sent as `Set`.
   */
  private buildSendAuthEdit(sendView: SendView, plaintextPassword?: string): AuthEdit {
    if (sendView.authType === AuthType.Password && plaintextPassword == null) {
      return { type: "preserve" };
    }
    return { type: "set", auth: this.buildSendAuth(sendView, plaintextPassword) };
  }

  // SendView.deletionDate is typed as `Date` but declared with a `null` default, and
  // the file is `@ts-strict-ignore`. The SDK's SendAddRequest/SendEditRequest require a
  // non-null `DateTime<Utc>`. Fail fast at this boundary so a missing date surfaces as
  // a clear error rather than a confusing `.toISOString()` TypeError or a server-side
  // validation failure.
  private requireDeletionDate(sendView: SendView): Date {
    if (sendView.deletionDate == null) {
      throw new Error("Send is missing a deletion date.");
    }
    return sendView.deletionDate;
  }

  /**
   * @param fileName Overrides `sendView.file.fileName` for a file create. The Send form no
   *   longer populates `sendView.file` for a new file (`FileUploadComponent` only ever hands
   *   back a real `File`, not view metadata) — {@link createFileSend} derives the name from that
   *   `File` directly, the same way the legacy path's `SendService.encrypt` does.
   */
  private buildSendViewType(sendView: SendView, fileName?: string): SendViewType {
    if (sendView.type === SendType.File) {
      const resolvedFileName = fileName ?? sendView.file?.fileName;
      if (!resolvedFileName) {
        throw new Error("File send is missing a file name.");
      }
      return {
        File: {
          id: sendView.file?.id ?? undefined,
          fileName: resolvedFileName,
          size: sendView.file?.size?.toString() ?? undefined,
          sizeName: sendView.file?.sizeName ?? undefined,
        },
      };
    }
    return {
      Text: {
        text: sendView.text?.text ?? undefined,
        hidden: sendView.text?.hidden ?? false,
      },
    };
  }

  /**
   * Builds the SDK `SendAuthType` for a create, or for an edit that sets/changes the auth
   * (see {@link buildSendAuthEdit} for the `Preserve` case, which never reaches here).
   *
   * For a password-protected send, this always has a plaintext password to work with: a
   * create always sets one, and an edit only calls this when the password is changing. The
   * SDK derives the proof-of-knowledge with PBKDF2 over the key it generates, keeping
   * password and key consistent by construction.
   *
   * The plaintext password is Protected Data — this method must never log it or place it in
   * error messages.
   */
  private buildSendAuth(sendView: SendView, plaintextPassword?: string): SendAuthType {
    switch (sendView.authType) {
      case AuthType.Email:
        if (sendView.emails == null || sendView.emails.length === 0) {
          throw new Error("Email-protected send is missing recipient emails.");
        }
        return { type: "emails", emails: sendView.emails };
      case AuthType.Password:
        if (plaintextPassword == null) {
          throw new Error("Password-protected send is missing its password.");
        }
        return { type: "password", password: plaintextPassword };
      case AuthType.None:
      default:
        return { type: "none" };
    }
  }
}
