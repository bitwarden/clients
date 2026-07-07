import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  SendAddRequest,
  SendAuthType,
  SendEditRequest,
  SendView as SdkSendView,
} from "@bitwarden/sdk-internal";

import { mockAccountServiceWith } from "../../../../spec";
import { AccountService } from "../../../auth/abstractions/account.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendResponse } from "../models/response/send.response";
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

  let sendsClient: { create: jest.Mock; edit: jest.Mock };

  let service: SendSdkApiService;

  beforeEach(() => {
    sdkService = mock<SdkService>();
    legacySendApiService = mock<SendApiService>();
    sendService = mock<InternalSendService>();
    accountService = mockAccountServiceWith(mockUserId);
    logService = mock<LogService>();

    const sdkView = { id: "server-id", accessId: "server-access-id" } as unknown as SdkSendView;
    sendsClient = {
      create: jest.fn().mockResolvedValue(sdkView),
      edit: jest.fn().mockResolvedValue(sdkView),
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
    it("forwards the pre-derived keyB64 verbatim for a password-protected create", async () => {
      const view = textView({
        authType: AuthType.Password,
        password: "derived-keyB64",
      });
      const send = sendResolvingTo(view, null);

      await service.save([send, mock<EncArrayBuffer>()]);

      const request = sendsClient.create.mock.calls[0][0] as SendAddRequest;
      const auth: SendAuthType = request.auth;
      expect(auth).toEqual({ type: "hashedPassword", keyB64: "derived-keyB64" });
    });

    it("forwards the pre-derived keyB64 verbatim for a password-protected edit", async () => {
      const existingId = Utils.newGuid();
      const view = textView({
        id: existingId,
        authType: AuthType.Password,
        password: "derived-keyB64",
      });
      const send = sendResolvingTo(view, existingId);

      await service.save([send, mock<EncArrayBuffer>()]);

      const request = sendsClient.edit.mock.calls[0][1] as SendEditRequest;
      const auth: SendAuthType = request.auth;
      expect(auth).toEqual({ type: "hashedPassword", keyB64: "derived-keyB64" });
    });

    it("throws when a password-protected send is missing its derived key", async () => {
      const view = textView({
        authType: AuthType.Password,
        password: null,
      });
      const send = sendResolvingTo(view, null);

      await expect(service.save([send, mock<EncArrayBuffer>()])).rejects.toThrow(
        "Password-protected send is missing its derived key.",
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
});
