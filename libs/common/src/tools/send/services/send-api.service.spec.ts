import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";
import {
  AuthEdit,
  CreateFileSendResponse,
  FileUploadType,
  SendAddRequest,
  SendAuthType,
  SendEditRequest,
  SendView as SdkSendView,
} from "@bitwarden/sdk-internal";

import { mockAccountServiceWith } from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { FileUploadType as RestFileUploadType } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendAccessView } from "../models/view/send-access.view";
import { SendFileView } from "../models/view/send-file.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { MAX_SDK_FILE_SEND_SIZE_BYTES, SendApiService } from "./send-api.service";
import { SendDecryptionService } from "./send-decryption.service";
import { InternalSendService } from "./send.service.abstraction";

describe("SendApiService", () => {
  const mockUserId = Utils.newGuid() as UserId;

  let apiService: MockProxy<ApiService>;
  let fileUploadService: MockProxy<FileUploadService>;
  let sdkService: SdkService;
  let sendService: MockProxy<InternalSendService>;
  let accountService: AccountService;
  let logService: MockProxy<LogService>;
  let sendDecryptionService: MockProxy<SendDecryptionService>;

  let sendsClient: {
    create: jest.Mock;
    edit: jest.Mock;
    create_file_send: jest.Mock;
    upload_send_file: jest.Mock;
    delete: jest.Mock;
    remove_password: jest.Mock;
  };

  let createFileSendResponse: CreateFileSendResponse;

  let service: SendApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    fileUploadService = mock<FileUploadService>();
    sdkService = mock<SdkService>();
    sendService = mock<InternalSendService>();
    accountService = mockAccountServiceWith(mockUserId);
    logService = mock<LogService>();
    sendDecryptionService = mock<SendDecryptionService>();

    const sdkView = { id: "server-id", accessId: "server-access-id" } as unknown as SdkSendView;
    createFileSendResponse = {
      send: sdkView,
      url: "https://upload.example/blob",
      fileUploadType: FileUploadType.Azure,
      fileId: "server-file-id",
      encryptedFileName: "2.encrypted-file-name",
      encryptedFileBuffer: new Uint8Array([9, 8, 7]),
    };
    sendsClient = {
      create: jest.fn().mockResolvedValue(sdkView),
      edit: jest.fn().mockResolvedValue(sdkView),
      create_file_send: jest.fn().mockResolvedValue(createFileSendResponse),
      upload_send_file: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      remove_password: jest.fn().mockResolvedValue(undefined),
    };
    const client = {
      take: jest.fn().mockReturnValue({
        value: { sends: () => sendsClient },
        [Symbol.dispose]: jest.fn(),
      }),
    };
    (sdkService.userClient$ as jest.Mock).mockReturnValue(of(client));

    // Read-back after a mutation.
    apiService.send.mockResolvedValue({ id: "server-id" });

    service = new SendApiService(
      apiService,
      fileUploadService,
      sendService,
      logService,
      sdkService,
      accountService,
      sendDecryptionService,
    );
  });

  /** The REST read-back after a mutation. */
  const refreshCall = (id: string) => ["GET", "/sends/" + id, null, true, true];

  function sendResolvingTo(view: SendView, id: string | null): Send {
    const send = new Send();
    send.id = id;
    send.type = view.type;
    send.authType = view.authType;
    sendDecryptionService.decryptSend.mockResolvedValue(view);
    return send;
  }

  function textView(overrides: Partial<SendView>): SendView {
    const view = new SendView();
    view.type = SendType.Text;
    view.deletionDate = new Date("2025-01-01T00:00:00.000Z");
    return Object.assign(view, overrides);
  }

  describe("buildSendAuth via save", () => {
    it("emits the plaintext `password` variant for a password-protected create", async () => {
      const view = textView({ authType: AuthType.Password });
      const send = sendResolvingTo(view, null);

      await service.save([send, mock<EncArrayBuffer>()], "hunter2");

      const request = sendsClient.create.mock.calls[0][0] as SendAddRequest;
      const auth: SendAuthType = request.auth;
      expect(auth).toEqual({ type: "password", password: "hunter2" });
    });

    it("wraps the plaintext `password` variant in `AuthEdit::Set` for a password-changing edit", async () => {
      const existingId = Utils.newGuid();
      const view = textView({ id: existingId, authType: AuthType.Password });
      const send = sendResolvingTo(view, existingId);

      await service.save([send, mock<EncArrayBuffer>()], "new-password");

      const request = sendsClient.edit.mock.calls[0][1] as SendEditRequest;
      const auth: AuthEdit = request.auth;
      expect(auth).toEqual({ type: "set", auth: { type: "password", password: "new-password" } });
    });

    it("emits `AuthEdit::Preserve` for a password-preserving edit", async () => {
      const existingId = Utils.newGuid();
      const view = textView({ id: existingId, authType: AuthType.Password });
      const send = sendResolvingTo(view, existingId);

      // No plaintext on preserve: the SDK resolves the existing auth from its own state.
      await service.save([send, mock<EncArrayBuffer>()]);

      expect(sendService.getFromState).not.toHaveBeenCalled();
      const request = sendsClient.edit.mock.calls[0][1] as SendEditRequest;
      const auth: AuthEdit = request.auth;
      expect(auth).toEqual({ type: "preserve" });
    });

    it("throws when a password-protected create has no plaintext password", async () => {
      const view = textView({ authType: AuthType.Password });
      const send = sendResolvingTo(view, null);

      await expect(service.save([send, mock<EncArrayBuffer>()])).rejects.toThrow(
        "Password-protected send is missing its password.",
      );
      expect(sendsClient.create).not.toHaveBeenCalled();
    });

    it("emits a `none` auth variant for an unprotected send", async () => {
      const view = textView({ authType: AuthType.None });
      const send = sendResolvingTo(view, null);

      await service.save([send, mock<EncArrayBuffer>()]);

      const request = sendsClient.create.mock.calls[0][0] as SendAddRequest;
      expect(request.auth).toEqual({ type: "none" });
    });

    it("wraps non-password auth in `AuthEdit::Set` on edit, since it carries no secret to preserve", async () => {
      const existingId = Utils.newGuid();
      const view = textView({
        id: existingId,
        authType: AuthType.Email,
        emails: ["a@example.com"],
      });
      const send = sendResolvingTo(view, existingId);

      await service.save([send, mock<EncArrayBuffer>()]);

      const request = sendsClient.edit.mock.calls[0][1] as SendEditRequest;
      const auth: AuthEdit = request.auth;
      expect(auth).toEqual({ type: "set", auth: { type: "emails", emails: ["a@example.com"] } });
    });
  });

  describe("save routing", () => {
    // The pre-encrypted buffer's key can never match an SDK-generated one, so new file sends go
    // over REST.
    const newFileSendData = (): [Send, EncArrayBuffer] => {
      const send = new Send();
      send.id = null;
      send.type = SendType.File;
      send.file = { fileName: "notes.txt" } as any;
      return [send, mock<EncArrayBuffer>()];
    };

    beforeEach(() => {
      apiService.send.mockReset();
      apiService.send.mockResolvedValueOnce({
        fileUploadType: RestFileUploadType.Direct,
        url: null,
        sendResponse: { id: "server-id", accessId: "access-id", file: { id: "file-id" } },
      });
    });

    it("creates new file sends over REST, not through the SDK", async () => {
      const sendData = newFileSendData();

      const result = await service.save(sendData);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/sends/file/v2",
        expect.anything(),
        true,
        true,
      );
      expect(fileUploadService.upload).toHaveBeenCalledTimes(1);
      expect(sendService.upsert).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Send);
      expect(sendsClient.create).not.toHaveBeenCalled();
      expect(sendsClient.create_file_send).not.toHaveBeenCalled();
    });

    it("patches the server-assigned id and accessId onto a new file send", async () => {
      const sendData = newFileSendData();

      await service.save(sendData);

      expect(sendData[0].id).toBe("server-id");
      expect(sendData[0].accessId).toBe("access-id");
    });

    it("ignores the plaintext password for a new file send, which SendService.encrypt already consumed", async () => {
      await service.save(newFileSendData(), "hunter2");

      expect(sendsClient.create).not.toHaveBeenCalled();
      expect(sendDecryptionService.decryptSend).not.toHaveBeenCalled();
    });

    it("edits an existing file send through the SDK", async () => {
      const existingId = Utils.newGuid();
      const view = textView({
        id: existingId,
        type: SendType.File,
        authType: AuthType.None,
        file: Object.assign(new SendFileView(), { fileName: "notes.txt" }),
      });
      const send = sendResolvingTo(view, existingId);

      await service.save([send, mock<EncArrayBuffer>()]);

      expect(sendsClient.edit).toHaveBeenCalled();
      expect(fileUploadService.upload).not.toHaveBeenCalled();
    });

    it("creates a text send through the SDK", async () => {
      const send = sendResolvingTo(textView({ authType: AuthType.None }), null);

      await service.save([send, mock<EncArrayBuffer>()]);

      expect(sendsClient.create).toHaveBeenCalled();
      expect(fileUploadService.upload).not.toHaveBeenCalled();
    });

    describe("REST file send creation abort handling", () => {
      // PM-42963: a cancel must roll back the send instead of leaving it behind.
      it("bails before doing any network work when the signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
          service.save(newFileSendData(), undefined, controller.signal),
        ).rejects.toMatchObject({ name: "AbortError" });

        expect(apiService.send).not.toHaveBeenCalled();
        expect(fileUploadService.upload).not.toHaveBeenCalled();
      });

      describe("when the caller aborts after a successful upload", () => {
        // Aborting inside the upload mock simulates a cancel mid-upload; a pre-aborted signal
        // would hit the early bail instead.
        let controller: AbortController;

        beforeEach(() => {
          controller = new AbortController();
          fileUploadService.upload.mockImplementation(async () => {
            controller.abort();
          });
        });

        it("rolls back the created send and throws an AbortError instead of returning it", async () => {
          await expect(
            service.save(newFileSendData(), undefined, controller.signal),
          ).rejects.toMatchObject({ name: "AbortError" });

          expect(apiService.send).toHaveBeenCalledWith(
            "DELETE",
            "/sends/server-id",
            null,
            true,
            false,
          );
        });

        it("does not roll back or throw when the signal was never aborted", async () => {
          fileUploadService.upload.mockImplementation(async () => {
            // No abort.
          });

          await expect(
            service.save(newFileSendData(), undefined, controller.signal),
          ).resolves.toBeInstanceOf(Send);

          // Only the create POST; no rollback DELETE.
          expect(apiService.send).toHaveBeenCalledTimes(1);
        });

        it("still throws an AbortError, not the rollback's error, when the rollback itself fails", async () => {
          apiService.send.mockRejectedValueOnce(new Error("rollback failed"));

          await expect(
            service.save(newFileSendData(), undefined, controller.signal),
          ).rejects.toMatchObject({ name: "AbortError" });

          expect(logService.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed to roll back file send after a cancelled upload"),
          );
        });
      });
    });
  });

  describe("SDK-only mutations", () => {
    const sendId = Utils.newGuid();

    it("deletes through the SDK, then removes the send from local state, without a REST call", async () => {
      await service.delete(sendId);

      expect(sendsClient.delete).toHaveBeenCalledWith(sendId);
      expect(sendService.delete).toHaveBeenCalledWith(sendId);
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("removes the password through the SDK, then refetches the send over REST", async () => {
      await service.removePassword(sendId);

      expect(sendsClient.remove_password).toHaveBeenCalledWith(sendId);
      expect(apiService.send).toHaveBeenCalledTimes(1);
      expect(apiService.send).toHaveBeenCalledWith(...refreshCall(sendId));
      expect(sendService.upsert).toHaveBeenCalled();
    });
  });

  describe("send access", () => {
    const accessToken = { token: "access-token" } as SendAccessToken;
    let sharedAccessClient: { sends: jest.Mock };

    beforeEach(() => {
      sharedAccessClient = {
        sends: jest.fn().mockReturnValue({
          access_send: jest.fn().mockResolvedValue({}),
          get_file_download_data: jest.fn().mockResolvedValue({}),
        }),
      };
      (sdkService as { client$: unknown }).client$ = of(sharedAccessClient);
    });

    it.each([
      ["postSendAccess", (s: SendApiService) => s.postSendAccess(accessToken)],
      [
        "getSendFileDownloadData",
        (s: SendApiService) =>
          s.getSendFileDownloadData(
            { id: "id", file: { id: "file-id" } } as SendAccessView,
            accessToken,
          ),
      ],
    ])("%s uses the shared SDK client when no apiUrl is given", async (_name, invoke) => {
      await invoke(service);

      expect(sharedAccessClient.sends).toHaveBeenCalled();
      expect(apiService.send).not.toHaveBeenCalled();
    });

    // Any `apiUrl` goes to REST: it can't be trusted as a same-instance signal (PR #22321), and
    // the SDK only targets its own server.
    it("sends postSendAccess with an apiUrl over REST to that server, with the access token", async () => {
      await service.postSendAccess(accessToken, "https://other.example");

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/sends/access",
        null,
        false,
        true,
        "https://other.example",
        expect.any(Function),
      );
      const setHeader = apiService.send.mock.calls[0][6] as (headers: Headers) => void;
      const headers = new Headers();
      setHeader(headers);
      expect(headers.get("Authorization")).toBe("Bearer access-token");
      expect(sharedAccessClient.sends).not.toHaveBeenCalled();
    });

    it("sends getSendFileDownloadData with an apiUrl over REST to that server", async () => {
      const accessView = { id: "id", file: { id: "file-id" } } as SendAccessView;

      await service.getSendFileDownloadData(accessView, accessToken, "https://other.example");

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/sends/access/file/file-id",
        null,
        false,
        true,
        "https://other.example",
        expect.any(Function),
      );
      expect(sharedAccessClient.sends).not.toHaveBeenCalled();
    });
  });

  describe("saveView", () => {
    function fileView(overrides: Partial<SendView> = {}): SendView {
      const view = new SendView();
      view.type = SendType.File;
      view.name = "a-file";
      view.authType = AuthType.None;
      view.deletionDate = new Date("2025-01-01T00:00:00.000Z");
      view.file = Object.assign(new SendFileView(), { fileName: "notes.txt" });
      return Object.assign(view, overrides);
    }

    it("hands the plaintext view to the SDK without encrypting client-side", async () => {
      const view = textView({ name: "plaintext-name", authType: AuthType.None });

      await service.saveView(view, null);

      const request = sendsClient.create.mock.calls[0][0] as SendAddRequest;
      expect(request.name).toBe("plaintext-name");
      expect(sendService.encrypt).not.toHaveBeenCalled();
    });

    it("edits an existing send through the SDK", async () => {
      const existingId = Utils.newGuid();
      const view = textView({ id: existingId, authType: AuthType.None });

      await service.saveView(view, null);

      expect(sendsClient.edit).toHaveBeenCalledWith(existingId, expect.anything());
      expect(sendsClient.create).not.toHaveBeenCalled();
    });

    describe("file send creation", () => {
      const plaintextBytes = new Uint8Array([1, 2, 3, 4]);

      it("hands the plaintext bytes and the request built from the view to `create_file_send`", async () => {
        const view = fileView({ name: "plaintext-name" });

        await service.saveView(view, plaintextBytes.buffer);

        expect(sendsClient.create_file_send).toHaveBeenCalledTimes(1);
        const [request, buffer] = sendsClient.create_file_send.mock.calls[0];
        expect((request as SendAddRequest).name).toBe("plaintext-name");
        // Plaintext: the SDK does the encrypting.
        expect(buffer).toEqual(plaintextBytes);
        expect(sendService.encrypt).not.toHaveBeenCalled();
        expect(sendsClient.create).not.toHaveBeenCalled();
      });

      it("reads the plaintext bytes out of a `File`", async () => {
        const file = {
          name: "notes.txt",
          arrayBuffer: jest.fn().mockResolvedValue(plaintextBytes.buffer),
        } as unknown as File;

        await service.saveView(fileView(), file);

        expect(sendsClient.create_file_send.mock.calls[0][1]).toEqual(plaintextBytes);
      });

      // The form doesn't populate `view.file` for a new file; the `File` is the only name source.
      it("derives the file name from a real `File` even when the view has no file metadata", async () => {
        const view = fileView({ name: "plaintext-name" });
        view.file = undefined;
        const file = {
          name: "from-the-real-file.txt",
          arrayBuffer: jest.fn().mockResolvedValue(plaintextBytes.buffer),
        } as unknown as File;

        await service.saveView(view, file);

        const [request] = sendsClient.create_file_send.mock.calls[0];
        expect((request as SendAddRequest).viewType).toEqual({
          File: expect.objectContaining({ fileName: "from-the-real-file.txt" }),
        });
      });

      // The CLI passes an ArrayBuffer and sets `view.file.fileName` itself.
      it("falls back to the view's file name for an `ArrayBuffer`", async () => {
        const view = fileView({ name: "plaintext-name" });
        view.file = Object.assign(new SendFileView(), { fileName: "from-the-view.txt" });

        await service.saveView(view, plaintextBytes.buffer);

        const [request] = sendsClient.create_file_send.mock.calls[0];
        expect((request as SendAddRequest).viewType).toEqual({
          File: expect.objectContaining({ fileName: "from-the-view.txt" }),
        });
      });

      it("rejects a create with no file name available from either source", async () => {
        const view = fileView();
        view.file = undefined;

        await expect(service.saveView(view, plaintextBytes.buffer)).rejects.toThrow(
          "File send is missing a file name.",
        );
      });

      it("uploads the ciphertext and metadata the create step returned", async () => {
        await service.saveView(fileView(), plaintextBytes.buffer);

        expect(sendsClient.upload_send_file).toHaveBeenCalledWith(
          "server-id",
          "server-file-id",
          "2.encrypted-file-name",
          FileUploadType.Azure,
          "https://upload.example/blob",
          new Uint8Array([9, 8, 7]),
        );
      });

      it("refreshes the wire-encrypted form of the created send once the upload lands", async () => {
        await service.saveView(fileView(), plaintextBytes.buffer);

        expect(apiService.send).toHaveBeenCalledWith(...refreshCall("server-id"));
      });

      it("does not abandon an in-flight upload when userClient$ emits again mid-upload", async () => {
        const userClient$ = new Subject<{ take: jest.Mock }>();
        (sdkService.userClient$ as jest.Mock).mockReturnValue(userClient$);

        let resolveUpload: () => void;
        sendsClient.upload_send_file.mockReturnValue(
          new Promise<void>((resolve) => {
            resolveUpload = resolve;
          }),
        );

        const makeClient = () => ({
          take: jest.fn().mockReturnValue({
            value: { sends: () => sendsClient },
            [Symbol.dispose]: jest.fn(),
          }),
        });

        // A macrotask boundary flushes all queued microtasks.
        const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

        const result = service.saveView(fileView(), plaintextBytes.buffer);

        await flushMicrotasks();
        expect(sdkService.userClient$).toHaveBeenCalled();
        userClient$.next(makeClient());

        // Let the callback reach the pending upload_send_file.
        await flushMicrotasks();
        expect(sendsClient.upload_send_file).toHaveBeenCalledTimes(1);

        // Unrelated re-emission while the upload is pending.
        userClient$.next(makeClient());

        resolveUpload();

        await expect(result).resolves.toBeDefined();
        // The in-flight execution was not restarted for the second client.
        expect(sendsClient.create_file_send).toHaveBeenCalledTimes(1);
        expect(sendsClient.upload_send_file).toHaveBeenCalledTimes(1);
      }, 2000);

      it("rejects a file create with no file data, which the create step cannot size", async () => {
        await expect(service.saveView(fileView(), null)).rejects.toThrow(
          "File send creation requires file data.",
        );
        expect(sendsClient.create_file_send).not.toHaveBeenCalled();
      });

      // Oversized files must fail fast rather than risk exhausting memory mid-upload.
      describe("file size guard", () => {
        it("rejects an ArrayBuffer over the size limit without calling the SDK", async () => {
          const oversized = new ArrayBuffer(MAX_SDK_FILE_SEND_SIZE_BYTES + 1);

          await expect(service.saveView(fileView(), oversized)).rejects.toThrow(
            "File is too large to send",
          );
          expect(sendsClient.create_file_send).not.toHaveBeenCalled();
        });

        it("rejects a `File` over the size limit without reading its contents", async () => {
          const arrayBuffer = jest.fn();
          const oversizedFile = {
            name: "big.bin",
            size: MAX_SDK_FILE_SEND_SIZE_BYTES + 1,
            arrayBuffer,
          } as unknown as File;

          await expect(service.saveView(fileView(), oversizedFile)).rejects.toThrow(
            "File is too large to send",
          );
          expect(arrayBuffer).not.toHaveBeenCalled();
          expect(sendsClient.create_file_send).not.toHaveBeenCalled();
        });

        it("allows a file exactly at the size limit", async () => {
          const atLimit = new ArrayBuffer(MAX_SDK_FILE_SEND_SIZE_BYTES);

          await service.saveView(fileView(), atLimit);

          expect(sendsClient.create_file_send).toHaveBeenCalledTimes(1);
        });
      });

      describe("when the upload fails", () => {
        beforeEach(() => {
          sendsClient.upload_send_file.mockRejectedValue(new Error("upload failed"));
        });

        it("rolls back the created send and surfaces the upload error", async () => {
          await expect(service.saveView(fileView(), plaintextBytes.buffer)).rejects.toThrow(
            "upload failed",
          );

          expect(sendsClient.delete).toHaveBeenCalledWith("server-id");
        });

        it("still surfaces the upload error when the rollback itself fails", async () => {
          sendsClient.delete.mockRejectedValue(new Error("rollback failed"));

          await expect(service.saveView(fileView(), plaintextBytes.buffer)).rejects.toThrow(
            "upload failed",
          );
        });
      });

      describe("when the caller aborts after a successful upload", () => {
        // PM-42963. Aborting inside the upload mock simulates a cancel mid-upload; a pre-aborted
        // signal would hit the early bail instead.
        it("rolls back the created send and throws an AbortError instead of returning it", async () => {
          const controller = new AbortController();
          sendsClient.upload_send_file.mockImplementation(async () => {
            controller.abort();
          });

          await expect(
            service.saveView(fileView(), plaintextBytes.buffer, undefined, controller.signal),
          ).rejects.toMatchObject({ name: "AbortError" });

          expect(sendsClient.delete).toHaveBeenCalledWith("server-id");
        });

        it("does not roll back or throw when the signal was never aborted", async () => {
          const controller = new AbortController();

          await service.saveView(fileView(), plaintextBytes.buffer, undefined, controller.signal);

          expect(sendsClient.delete).not.toHaveBeenCalled();
        });
      });

      it("bails before calling the SDK when the signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
          service.saveView(fileView(), plaintextBytes.buffer, undefined, controller.signal),
        ).rejects.toMatchObject({ name: "AbortError" });

        expect(sendsClient.create_file_send).not.toHaveBeenCalled();
        expect(sendsClient.upload_send_file).not.toHaveBeenCalled();
      });

      it("edits an existing file send through the SDK", async () => {
        const existingId = Utils.newGuid();

        await service.saveView(fileView({ id: existingId }), null);

        expect(sendsClient.edit).toHaveBeenCalledWith(existingId, expect.anything());
      });
    });

    describe("when the post-mutation refresh fails", () => {
      beforeEach(() => {
        apiService.send.mockRejectedValue(new Error("network down"));
      });

      it("falls back to the copy the SDK wrote to local state", async () => {
        const local = new Send();
        local.id = "server-id";
        sendService.getFromState.mockResolvedValue(local);

        const result = await service.saveView(textView({ authType: AuthType.None }), null);

        expect(result).toBe(local);
      });

      it("rethrows when local state cannot produce the send either", async () => {
        sendService.getFromState.mockResolvedValue(null as unknown as Send);

        await expect(service.saveView(textView({ authType: AuthType.None }), null)).rejects.toThrow(
          "network down",
        );
      });
    });
  });
});
