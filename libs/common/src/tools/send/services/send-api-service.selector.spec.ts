import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { SendAccessToken } from "../../../auth/send-access";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { Send } from "../models/domain/send";
import { SendAccessRequest } from "../models/request/send-access.request";
import { SendAccessView } from "../models/view/send-access.view";
import { AuthType } from "../types/auth-type";
import { SendType } from "../types/send-type";

import { SendApiServiceSelector } from "./send-api-service.selector";
import { SendApiService } from "./send-api.service";
import { SendSdkApiService } from "./send-sdk-api.service";

describe("SendApiServiceSelector", () => {
  let configService: MockProxy<ConfigService>;
  let legacy: MockProxy<SendApiService>;
  let sdk: MockProxy<SendSdkApiService>;
  let flag$: BehaviorSubject<boolean>;

  function buildSelector(initialFlag: boolean): SendApiServiceSelector {
    flag$ = new BehaviorSubject<boolean>(initialFlag);
    configService.getFeatureFlag$.mockImplementation((key) =>
      key === FeatureFlag.Pm30110SdkSendsApi ? flag$.asObservable() : (undefined as any),
    );
    return new SendApiServiceSelector(configService, legacy, sdk);
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    legacy = mock<SendApiService>();
    sdk = mock<SendSdkApiService>();
  });

  describe("save", () => {
    it("routes to legacy when creating a file send, even with the flag on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.File;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(legacy.save).toHaveBeenCalledWith([send, buffer]);
      expect(sdk.save).not.toHaveBeenCalled();
    });

    it("routes to SDK for text creates when the flag is on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.Text;
      send.authType = AuthType.None;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(sdk.save).toHaveBeenCalledWith([send, buffer]);
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("routes to SDK for file edits when the flag is on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = "existing-id";
      send.type = SendType.File;
      send.authType = AuthType.None;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(sdk.save).toHaveBeenCalledWith([send, buffer]);
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("routes to legacy for password-protected creates, even with the flag on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.Text;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(legacy.save).toHaveBeenCalledWith([send, buffer]);
      expect(sdk.save).not.toHaveBeenCalled();
    });

    it("routes to legacy for password-protected edits, even with the flag on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = "existing-id";
      send.type = SendType.Text;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(legacy.save).toHaveBeenCalledWith([send, buffer]);
      expect(sdk.save).not.toHaveBeenCalled();
    });

    it("routes to legacy when the flag is off", async () => {
      const selector = buildSelector(false);
      const send = new Send();
      send.id = "existing-id";
      send.type = SendType.Text;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(legacy.save).toHaveBeenCalledWith([send, buffer]);
      expect(sdk.save).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["delete", (s: SendApiServiceSelector) => s.delete("id")],
    ["removePassword", (s: SendApiServiceSelector) => s.removePassword("id")],
    ["deleteSend", (s: SendApiServiceSelector) => s.deleteSend("id")],
  ])("%s — flag-controlled, no overrides", (methodName, invoke) => {
    it("routes to SDK when the flag is on", async () => {
      const selector = buildSelector(true);

      await invoke(selector);

      expect((sdk as any)[methodName]).toHaveBeenCalledWith("id");
      expect((legacy as any)[methodName]).not.toHaveBeenCalled();
    });

    it("routes to legacy when the flag is off", async () => {
      const selector = buildSelector(false);

      await invoke(selector);

      expect((legacy as any)[methodName]).toHaveBeenCalledWith("id");
      expect((sdk as any)[methodName]).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["getSend", (s: SendApiServiceSelector) => s.getSend("id"), ["id"]],
    ["getSends", (s: SendApiServiceSelector) => s.getSends(), []],
    ["putSendRemovePassword", (s: SendApiServiceSelector) => s.putSendRemovePassword("id"), ["id"]],
  ])("%s — always legacy", (methodName, invoke, expectedArgs) => {
    it.each([true, false])("routes to legacy regardless of flag (flag=%s)", async (flagOn) => {
      const selector = buildSelector(flagOn);

      await invoke(selector);

      expect((legacy as any)[methodName]).toHaveBeenCalledWith(...expectedArgs);
      expect((sdk as any)[methodName]).not.toHaveBeenCalled();
    });
  });

  describe("postSendAccess", () => {
    const request = new SendAccessRequest();

    it("routes to legacy when apiUrl is supplied, even with the flag on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccess("id", request, "https://other.example");

      expect(legacy.postSendAccess).toHaveBeenCalledWith("id", request, "https://other.example");
      expect(sdk.postSendAccess).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccess("id", request);

      expect(sdk.postSendAccess).toHaveBeenCalledWith("id", request);
      expect(legacy.postSendAccess).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.postSendAccess("id", request);

      expect(legacy.postSendAccess).toHaveBeenCalledWith("id", request);
      expect(sdk.postSendAccess).not.toHaveBeenCalled();
    });
  });

  describe("postSendAccessV2", () => {
    const accessToken: SendAccessToken = { token: "tok" } as SendAccessToken;

    it("routes to legacy when apiUrl is supplied, even with the flag on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccessV2(accessToken, "https://other.example");

      expect(legacy.postSendAccessV2).toHaveBeenCalledWith(accessToken, "https://other.example");
      expect(sdk.postSendAccessV2).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccessV2(accessToken);

      expect(sdk.postSendAccessV2).toHaveBeenCalledWith(accessToken);
      expect(legacy.postSendAccessV2).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.postSendAccessV2(accessToken);

      expect(legacy.postSendAccessV2).toHaveBeenCalledWith(accessToken);
      expect(sdk.postSendAccessV2).not.toHaveBeenCalled();
    });
  });

  describe("getSendFileDownloadData", () => {
    const accessView = mock<SendAccessView>();
    const request = new SendAccessRequest();

    it("routes to legacy when apiUrl is supplied, even with the flag on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadData(accessView, request, "https://other.example");

      expect(legacy.getSendFileDownloadData).toHaveBeenCalledWith(
        accessView,
        request,
        "https://other.example",
      );
      expect(sdk.getSendFileDownloadData).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadData(accessView, request);

      expect(sdk.getSendFileDownloadData).toHaveBeenCalledWith(accessView, request);
      expect(legacy.getSendFileDownloadData).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.getSendFileDownloadData(accessView, request);

      expect(legacy.getSendFileDownloadData).toHaveBeenCalledWith(accessView, request);
      expect(sdk.getSendFileDownloadData).not.toHaveBeenCalled();
    });
  });

  describe("getSendFileDownloadDataV2", () => {
    const accessView = mock<SendAccessView>();
    const accessToken: SendAccessToken = { token: "tok" } as SendAccessToken;

    it("routes to legacy when apiUrl is supplied, even with the flag on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadDataV2(accessView, accessToken, "https://other.example");

      expect(legacy.getSendFileDownloadDataV2).toHaveBeenCalledWith(
        accessView,
        accessToken,
        "https://other.example",
      );
      expect(sdk.getSendFileDownloadDataV2).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadDataV2(accessView, accessToken);

      expect(sdk.getSendFileDownloadDataV2).toHaveBeenCalledWith(accessView, accessToken);
      expect(legacy.getSendFileDownloadDataV2).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.getSendFileDownloadDataV2(accessView, accessToken);

      expect(legacy.getSendFileDownloadDataV2).toHaveBeenCalledWith(accessView, accessToken);
      expect(sdk.getSendFileDownloadDataV2).not.toHaveBeenCalled();
    });
  });

  describe("feature flag caching", () => {
    it("subscribes to the feature flag once across many calls", async () => {
      const selector = buildSelector(true);

      await selector.delete("a");
      await selector.delete("b");
      await selector.deleteSend("c");
      await selector.removePassword("d");

      expect(configService.getFeatureFlag$).toHaveBeenCalledTimes(1);
    });

    it("picks up flag changes for subsequent calls", async () => {
      const selector = buildSelector(true);

      await selector.delete("first");
      flag$.next(false);
      await selector.delete("second");

      expect(sdk.delete).toHaveBeenCalledWith("first");
      expect(legacy.delete).toHaveBeenCalledWith("second");
    });
  });
});
