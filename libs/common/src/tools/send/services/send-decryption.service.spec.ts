import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { newGuid } from "@bitwarden/guid";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import {
  SendClient,
  SendView as SdkSendView,
  SendAccessView as SdkSendAccessView,
} from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendAccess } from "../models/domain/send-access";
import { SendAccessResponse } from "../models/response/send-access.response";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";

import { SendDecryptionService } from "./send-decryption.service";

describe("SendDecryptionService", () => {
  const mockUserId = newGuid() as UserId;

  let sdkService: MockProxy<SdkService>;
  let configService: MockProxy<ConfigService>;
  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let service: SendDecryptionService;

  let sendsClient: { decrypt_send: jest.Mock };
  const decrypt_send_access_mock = jest.spyOn(SendClient, "decrypt_send_access");

  beforeEach(() => {
    sdkService = mock<SdkService>();
    configService = mock<ConfigService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();

    sendsClient = {
      decrypt_send: jest.fn(),
    };
    decrypt_send_access_mock.mockReset();

    (sdkService.userClient$ as jest.Mock).mockReturnValue(
      of({
        take: () => ({
          value: {
            sends: () => sendsClient,
          },
          [Symbol.dispose]: () => {},
        }),
      }),
    );

    service = new SendDecryptionService(sdkService, configService, legacyCompatKeyService);
  });

  describe("decryptSend", () => {
    it("uses SDK when feature flag is enabled", async () => {
      const send = new Send();
      send.id = "test-id";
      const mockKey = new Uint8Array(16);
      const sdkSendView = {
        id: "sdk-id",
        key: Utils.fromArrayToUrlB64(mockKey),
      } as unknown as SdkSendView;
      const sendView = { id: "sdk-id", key: mockKey } as unknown as SendView;
      const mockCryptoKey = new SymmetricCryptoKey(new Uint8Array(32));

      configService.getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(send, "toSdkSend").mockReturnValue({} as any);
      sendsClient.decrypt_send.mockReturnValue(sdkSendView);
      jest.spyOn(SendView, "fromSdkSendView").mockReturnValue(sendView);
      legacyCompatKeyService.makeSendKey.mockResolvedValue(mockCryptoKey);

      const result = await service.decryptSend(send, mockUserId);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pm30110SdkSendsApi);
      expect(sendsClient.decrypt_send).toHaveBeenCalled();
      expect(legacyCompatKeyService.makeSendKey).toHaveBeenCalledWith(mockKey);
      expect(result.cryptoKey).toBe(mockCryptoKey);
    });

    it("throws when feature flag is enabled and SDK is not available", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));

      await expect(service.decryptSend(new Send(), mockUserId)).rejects.toThrow(
        "SDK not available",
      );
    });

    it("uses legacy decrypt when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      const send = new Send();
      send.id = "test-id";

      const mockSendView = new SendView();
      jest.spyOn(send, "decrypt").mockResolvedValue(mockSendView);

      const result = await service.decryptSend(send, mockUserId);

      expect(send.decrypt).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(mockSendView);
      expect(sendsClient.decrypt_send).not.toHaveBeenCalled();
    });
  });

  describe("decryptSends", () => {
    it("uses SDK when feature flag is enabled", async () => {
      const mockKey = new Uint8Array(32);
      const mockCryptoKey = new SymmetricCryptoKey(mockKey);

      const sdkSendView1 = { id: "sdk-id-1", key: Buffer.from(mockKey) } as unknown as SdkSendView;
      const sdkSendView2 = { id: "sdk-id-2", key: Buffer.from(mockKey) } as unknown as SdkSendView;

      sendsClient.decrypt_send.mockReturnValueOnce(sdkSendView1).mockReturnValueOnce(sdkSendView2);

      legacyCompatKeyService.makeSendKey.mockResolvedValue(mockCryptoKey);
      configService.getFeatureFlag.mockResolvedValue(true);

      const send1 = new Send();
      send1.id = "test-id-1";
      jest.spyOn(send1, "toSdkSend").mockReturnValue({} as any);

      const send2 = new Send();
      send2.id = "test-id-2";
      jest.spyOn(send2, "toSdkSend").mockReturnValue({} as any);

      const sendView1 = new SendView();
      sendView1.id = "view-id-1";
      const sendView2 = new SendView();
      sendView2.id = "view-id-2";

      jest
        .spyOn(SendView, "fromSdkSendView")
        .mockReturnValueOnce(sendView1)
        .mockReturnValueOnce(sendView2);

      const result = await service.decryptSends([send1, send2], mockUserId);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pm30110SdkSendsApi);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(sendView1);
      expect(result[1]).toBe(sendView2);
      expect(result[0].cryptoKey).toBe(mockCryptoKey);
      expect(result[1].cryptoKey).toBe(mockCryptoKey);
    });

    it("throws when feature flag is enabled and SDK is not available", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);
      (sdkService.userClient$ as jest.Mock).mockReturnValue(of(null));

      await expect(service.decryptSends([new Send()], mockUserId)).rejects.toThrow(
        "SDK not available",
      );
    });

    it("uses legacy decrypt when feature flag is disabled", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      const send1 = new Send();
      send1.id = "test-id-1";

      const send2 = new Send();
      send2.id = "test-id-2";

      const mockSendView1 = new SendView();
      mockSendView1.id = "view-id-1";
      const mockSendView2 = new SendView();
      mockSendView2.id = "view-id-2";

      jest.spyOn(send1, "decrypt").mockResolvedValue(mockSendView1);

      jest.spyOn(send2, "decrypt").mockResolvedValue(mockSendView2);

      const result = await service.decryptSends([send1, send2], mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockSendView1);
      expect(result[1]).toBe(mockSendView2);
      expect(sendsClient.decrypt_send).not.toHaveBeenCalled();
    });
  });

  describe("decryptSendAccess", () => {
    it("uses SDK when feature flag is enabled", async () => {
      const sendResponse = new SendAccessResponse({ Id: "response-id" });
      const keyArray = new Uint8Array(16);
      const mockCryptoKey = new SymmetricCryptoKey(new Uint8Array(32));
      const sdkAccessView = { id: "sdk-access-id" } as unknown as SdkSendAccessView;
      const mockAccessView = new SendAccessView();
      mockAccessView.id = "access-view-id";

      configService.getFeatureFlag.mockResolvedValue(true);
      legacyCompatKeyService.makeSendKey.mockResolvedValue(mockCryptoKey);
      jest.spyOn(SendAccessResponse, "toSdkAccessResponse").mockReturnValue({} as any);
      jest.spyOn(Utils, "fromArrayToUrlB64").mockReturnValue("encoded-key" as any);
      decrypt_send_access_mock.mockReturnValue(sdkAccessView);
      jest.spyOn(SendAccessView, "fromSdk").mockReturnValue(mockAccessView);

      const [accessView, cryptoKey] = await service.decryptSendAccess(sendResponse, keyArray);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pm30110SdkSendsApi);
      expect(legacyCompatKeyService.makeSendKey).toHaveBeenCalledWith(keyArray);
      expect(SendAccessResponse.toSdkAccessResponse).toHaveBeenCalledWith(sendResponse);
      expect(Utils.fromArrayToUrlB64).toHaveBeenCalledWith(keyArray);
      expect(decrypt_send_access_mock).toHaveBeenCalledWith("encoded-key", {});
      expect(SendAccessView.fromSdk).toHaveBeenCalledWith(sdkAccessView);
      expect(accessView).toBe(mockAccessView);
      expect(cryptoKey).toBe(mockCryptoKey);
    });

    it("uses legacy decrypt when feature flag is disabled", async () => {
      const keyArray = new Uint8Array(16);
      const mockCryptoKey = new SymmetricCryptoKey(new Uint8Array(32));

      configService.getFeatureFlag.mockResolvedValue(false);
      legacyCompatKeyService.makeSendKey.mockResolvedValue(mockCryptoKey);

      const sendResponse = new SendAccessResponse({ Id: "response-id" });

      const mockAccessView = new SendAccessView();
      mockAccessView.id = "access-view-id";

      jest.spyOn(SendAccess.prototype, "decrypt").mockResolvedValue(mockAccessView);

      const [accessView, cryptoKey] = await service.decryptSendAccess(sendResponse, keyArray);

      expect(legacyCompatKeyService.makeSendKey).toHaveBeenCalledWith(keyArray);
      expect(accessView).toBe(mockAccessView);
      expect(cryptoKey).toBe(mockCryptoKey);
      expect(decrypt_send_access_mock).not.toHaveBeenCalled();
    });
  });
});
