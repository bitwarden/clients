import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

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
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendResponse } from "../models/response/send.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendFileView } from "../models/view/send-file.view";
import { SendView } from "../models/view/send.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { SendSdkApiService } from "./send-sdk-api.service";
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
      encryptedFileBuffer: [9, 8, 7],
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
    let crossInstanceAccessClient: { sends: jest.Mock; [Symbol.dispose]: jest.Mock };

    function accessClient() {
      return {
        sends: jest.fn().mockReturnValue({
          access_send: jest.fn().mockResolvedValue({}),
          get_file_download_data: jest.fn().mockResolvedValue({}),
        }),
      };
    }

    beforeEach(() => {
      sharedAccessClient = accessClient();
      crossInstanceAccessClient = { ...accessClient(), [Symbol.dispose]: jest.fn() };
      (sdkService as { client$: unknown }).client$ = of(sharedAccessClient);
      (sdkService.createEphemeralClient as jest.Mock).mockResolvedValue(crossInstanceAccessClient);
    });

    it("uses the shared client when no apiUrl is supplied", async () => {
      await service.postSendAccess(accessToken);

      expect(sharedAccessClient.sends).toHaveBeenCalled();
      expect(sdkService.createEphemeralClient).not.toHaveBeenCalled();
    });

    it.each([
      [
        "postSendAccess",
        (s: SendSdkApiService, apiUrl: string) => s.postSendAccess(accessToken, apiUrl),
      ],
      [
        "getSendFileDownloadData",
        (s: SendSdkApiService, apiUrl: string) =>
          s.getSendFileDownloadData(
            { id: "id", file: { id: "file-id" } } as SendAccessView,
            accessToken,
            apiUrl,
          ),
      ],
    ])("%s targets the hosting instance and disposes the client", async (_name, invoke) => {
      await invoke(service, "https://api.other.example");

      expect(sdkService.createEphemeralClient).toHaveBeenCalledWith({
        apiUrl: "https://api.other.example",
      });
      expect(crossInstanceAccessClient.sends).toHaveBeenCalled();
      expect(sharedAccessClient.sends).not.toHaveBeenCalled();
      expect(crossInstanceAccessClient[Symbol.dispose]).toHaveBeenCalled();
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
          arrayBuffer: jest.fn().mockResolvedValue(plaintextBytes.buffer),
        } as unknown as File;

        await service.saveView(fileView(), file);

        expect(sendsClient.create_file_send.mock.calls[0][1]).toEqual(plaintextBytes);
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
