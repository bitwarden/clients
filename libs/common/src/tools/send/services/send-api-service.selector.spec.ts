import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";

import { SendAccessToken } from "../../../auth/send-access";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { Send } from "../models/domain/send";
import { SendAccessView } from "../models/view/send-access.view";
import { SendView } from "../models/view/send.view";
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

      expect(legacy.save).toHaveBeenCalledWith([send, buffer], undefined);
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

      expect(sdk.save).toHaveBeenCalledWith([send, buffer], undefined);
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

      expect(sdk.save).toHaveBeenCalledWith([send, buffer], undefined);
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("routes to SDK for password-protected creates when the flag is on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.Text;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(sdk.save).toHaveBeenCalledWith([send, buffer], undefined);
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("routes to SDK for password-protected edits when the flag is on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = "existing-id";
      send.type = SendType.Text;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(sdk.save).toHaveBeenCalledWith([send, buffer], undefined);
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("routes to legacy when the flag is off", async () => {
      const selector = buildSelector(false);
      const send = new Send();
      send.id = "existing-id";
      send.type = SendType.Text;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer]);

      expect(legacy.save).toHaveBeenCalledWith([send, buffer], undefined);
      expect(sdk.save).not.toHaveBeenCalled();
    });

    it("forwards the plaintext password to the SDK service when the flag is on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.Text;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer], "hunter2");

      expect(sdk.save).toHaveBeenCalledWith([send, buffer], "hunter2");
      expect(legacy.save).not.toHaveBeenCalled();
    });

    it("forwards the plaintext password to legacy for a new file send, even with the flag on", async () => {
      const selector = buildSelector(true);
      const send = new Send();
      send.id = null;
      send.type = SendType.File;
      send.authType = AuthType.Password;
      const buffer = mock<EncArrayBuffer>();

      await selector.save([send, buffer], "hunter2");

      expect(legacy.save).toHaveBeenCalledWith([send, buffer], "hunter2");
      expect(sdk.save).not.toHaveBeenCalled();
    });
  });

  describe("saveView", () => {
    function view(type: SendType, id: string | null): SendView {
      const sendView = new SendView();
      sendView.id = id;
      sendView.type = type;
      sendView.authType = AuthType.None;
      return sendView;
    }

    // Unlike `save`, file creates are flag-controlled here: the plaintext contents let the SDK
    // create and upload under the key it generates. See `SendSdkApiService.saveView`.
    it.each([
      ["file create", SendType.File, null],
      ["file edit", SendType.File, "existing-id"],
      ["text create", SendType.Text, null],
      ["text edit", SendType.Text, "existing-id"],
    ])("routes a %s to the SDK when the flag is on", async (_name, type, id) => {
      const selector = buildSelector(true);
      const sendView = view(type, id);
      const file = new ArrayBuffer(4);

      await selector.saveView(sendView, file, "hunter2");

      expect(sdk.saveView).toHaveBeenCalledWith(sendView, file, "hunter2");
      expect(legacy.saveView).not.toHaveBeenCalled();
    });

    it.each([
      ["file create", SendType.File, null],
      ["file edit", SendType.File, "existing-id"],
      ["text create", SendType.Text, null],
      ["text edit", SendType.Text, "existing-id"],
    ])("routes a %s to legacy when the flag is off", async (_name, type, id) => {
      const selector = buildSelector(false);
      const sendView = view(type, id);

      await selector.saveView(sendView, null);

      expect(legacy.saveView).toHaveBeenCalledWith(sendView, null, undefined);
      expect(sdk.saveView).not.toHaveBeenCalled();
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
    const accessToken: SendAccessToken = { token: "tok" } as SendAccessToken;

    // `apiUrl` is not a reliable cross-instance signal at the call site (see PR #22321 review
    // discussion), so these always route to legacy regardless of the flag — matching the SDK
    // client's inability to target anything but its own configured environment.
    it("routes a cross-instance apiUrl to legacy even when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccess(accessToken, "https://other.example");

      expect(legacy.postSendAccess).toHaveBeenCalledWith(accessToken, "https://other.example");
      expect(sdk.postSendAccess).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.postSendAccess(accessToken);

      expect(sdk.postSendAccess).toHaveBeenCalledWith(accessToken);
      expect(legacy.postSendAccess).not.toHaveBeenCalled();
    });

    it("routes a cross-instance apiUrl to legacy when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.postSendAccess(accessToken, "https://other.example");

      expect(legacy.postSendAccess).toHaveBeenCalledWith(accessToken, "https://other.example");
      expect(sdk.postSendAccess).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.postSendAccess(accessToken);

      expect(legacy.postSendAccess).toHaveBeenCalledWith(accessToken);
      expect(sdk.postSendAccess).not.toHaveBeenCalled();
    });
  });

  describe("getSendFileDownloadData", () => {
    const accessView = mock<SendAccessView>();
    const accessToken: SendAccessToken = { token: "tok" } as SendAccessToken;

    it("routes a cross-instance apiUrl to legacy even when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadData(accessView, accessToken, "https://other.example");

      expect(legacy.getSendFileDownloadData).toHaveBeenCalledWith(
        accessView,
        accessToken,
        "https://other.example",
      );
      expect(sdk.getSendFileDownloadData).not.toHaveBeenCalled();
    });

    it("routes to SDK without apiUrl when the flag is on", async () => {
      const selector = buildSelector(true);

      await selector.getSendFileDownloadData(accessView, accessToken);

      expect(sdk.getSendFileDownloadData).toHaveBeenCalledWith(accessView, accessToken);
      expect(legacy.getSendFileDownloadData).not.toHaveBeenCalled();
    });

    it("routes a cross-instance apiUrl to legacy when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.getSendFileDownloadData(accessView, accessToken, "https://other.example");

      expect(legacy.getSendFileDownloadData).toHaveBeenCalledWith(
        accessView,
        accessToken,
        "https://other.example",
      );
      expect(sdk.getSendFileDownloadData).not.toHaveBeenCalled();
    });

    it("routes to legacy without apiUrl when the flag is off", async () => {
      const selector = buildSelector(false);

      await selector.getSendFileDownloadData(accessView, accessToken);

      expect(legacy.getSendFileDownloadData).toHaveBeenCalledWith(accessView, accessToken);
      expect(sdk.getSendFileDownloadData).not.toHaveBeenCalled();
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
