import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

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
import { AccountService } from "../../../auth/abstractions/account.service";
import { SendAccessToken } from "../../../auth/send-access";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendFileView } from "../models/view/send-file.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { MAX_SDK_FILE_SEND_SIZE_BYTES, SendSdkApiService } from "./send-sdk-api.service";
import { InternalSendService } from "./send.service.abstraction";

describe("SendSdkApiService", () => {
  const mockUserId = Utils.newGuid() as UserId;

  let sdkService: SdkService;
  let legacySendApiService: MockProxy<SendApiService>;
  let sendService: MockProxy<InternalSendService>;
  let accountService: AccountService;
  let logService: MockProxy<LogService>;

  let sendsClient: {
    create: jest.Mock;
    edit: jest.Mock;
    create_file_send: jest.Mock;
    upload_send_file: jest.Mock;
    delete: jest.Mock;
  };

  /** What `create_file_send` hands back: the created send plus everything the upload needs. */
  let createFileSendResponse: CreateFileSendResponse;

  let service: SendSdkApiService;

  beforeEach(() => {
    sdkService = mock<SdkService>();
    legacySendApiService = mock<SendApiService>();
    sendService = mock<InternalSendService>();
    accountService = mockAccountServiceWith(mockUserId);
    logService = mock<LogService>();

    const sdkView = { id: "server-id", accessId: "server-access-id" } as unknown as SdkSendView;
    createFileSendResponse = {
      send: sdkView,
      url: "https://upload.example/blob",
      fileUploadType: FileUploadType.Azure,
      fileId: "server-file-id",
      // The SDK encrypted these internally under the key it generated; the caller only relays them.
      encryptedFileName: "2.encrypted-file-name",
      encryptedFileBuffer: new Uint8Array([9, 8, 7]),
    };
    sendsClient = {
      create: jest.fn().mockResolvedValue(sdkView),
      edit: jest.fn().mockResolvedValue(sdkView),
      create_file_send: jest.fn().mockResolvedValue(createFileSendResponse),
      upload_send_file: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const client = {
      take: jest.fn().mockReturnValue({
        value: { sends: () => sendsClient },
        [Symbol.dispose]: jest.fn(),
      }),
    };
    (sdkService.userClient$ as jest.Mock).mockReturnValue(of(client));

    // The refresh after a successful mutation goes through the legacy service; return a
    // minimal response so the happy path completes.
    legacySendApiService.getSend.mockResolvedValue({ id: "server-id" } as SendResponse);

    service = new SendSdkApiService(
      sdkService,
      legacySendApiService,
      sendService,
      accountService,
      logService,
    );
  });

  /** Builds a Send whose `decrypt` resolves to the provided view. */
  function sendResolvingTo(view: SendView, id: string | null): Send {
    const send = new Send();
    send.id = id;
    send.type = view.type;
    send.authType = view.authType;
    jest.spyOn(send, "decrypt").mockResolvedValue(view);
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
      // Plaintext lets the SDK derive the proof over the key it generates, keeping password
      // and key consistent.
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

      // On preserve the caller passes no plaintext; the SDK resolves the existing auth
      // against its own stored Send, so the client never needs to know the existing hash.
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

  describe("save guards", () => {
    it("rejects new file sends, which require the legacy service", async () => {
      const send = new Send();
      send.id = null;
      send.type = SendType.File;

      await expect(service.save([send, mock<EncArrayBuffer>()])).rejects.toThrow(
        "SendSdkApiService.save: file send creation requires SendApiService.",
      );
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

    // `apiUrl` is part of the shared SendApiService contract (legacy honours it for
    // cross-instance receive); SendApiServiceSelector always routes those calls to legacy, so it
    // never reaches here. These calls always use the shared client regardless.
    it.each([
      ["postSendAccess", (s: SendSdkApiService) => s.postSendAccess(accessToken)],
      [
        "getSendFileDownloadData",
        (s: SendSdkApiService) =>
          s.getSendFileDownloadData(
            { id: "id", file: { id: "file-id" } } as SendAccessView,
            accessToken,
          ),
      ],
    ])("%s uses the shared client", async (_name, invoke) => {
      await invoke(service);

      expect(sharedAccessClient.sends).toHaveBeenCalled();
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
        // Plaintext: the SDK encrypts internally under the key it generates, so nothing is
        // encrypted client-side and no key material is exposed here.
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

      // Regression: the Send form no longer populates `view.file` for a new file — a real `File`
      // is the only source of the name in that case, the same way legacy's `SendService.encrypt`
      // reads `file.name` directly instead of trusting the view.
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

      // The CLI hands over plaintext bytes as an `ArrayBuffer` and has no `File` to read a name
      // off, so it sets `view.file.fileName` itself beforehand — that must still work.
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

        expect(legacySendApiService.getSend).toHaveBeenCalledWith("server-id");
      });

      it("rejects a file create with no file data, which the create step cannot size", async () => {
        await expect(service.saveView(fileView(), null)).rejects.toThrow(
          "File send creation requires file data.",
        );
        expect(sendsClient.create_file_send).not.toHaveBeenCalled();
      });

      // Regression guard for the PM-41234-tracked SDK gap: `encryptedFileBuffer` crosses the
      // wasm boundary as a `number[]`, not a typed array, costing several times the file's byte
      // length in JS heap. Until that's fixed upstream, oversized files must fail fast with a
      // clear error rather than risk exhausting memory (worst case in a browser extension's
      // service worker) partway through create_file_send/upload_send_file.
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

          // Without the rollback the server keeps a permanent, content-less send.
          expect(sendsClient.delete).toHaveBeenCalledWith("server-id");
        });

        it("still surfaces the upload error when the rollback itself fails", async () => {
          sendsClient.delete.mockRejectedValue(new Error("rollback failed"));

          await expect(service.saveView(fileView(), plaintextBytes.buffer)).rejects.toThrow(
            "upload failed",
          );
        });
      });

      it("edits an existing file send through the SDK", async () => {
        const existingId = Utils.newGuid();

        await service.saveView(fileView({ id: existingId }), null);

        expect(sendsClient.edit).toHaveBeenCalledWith(existingId, expect.anything());
      });
    });

    describe("when the post-mutation refresh fails", () => {
      beforeEach(() => {
        legacySendApiService.getSend.mockRejectedValue(new Error("network down"));
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
