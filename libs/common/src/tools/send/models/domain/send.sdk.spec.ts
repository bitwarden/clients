import { AuthType as SdkAuthType, SendType as SdkSendType } from "@bitwarden/sdk-internal";

import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import { SendFileData } from "../data/send-file.data";
import { SendTextData } from "../data/send-text.data";
import { SendData } from "../data/send.data";

import { Send } from "./send";
import { SendRecordMapper } from "./send-sdk-mapper";

/**
 * Round-trip tests for the domain `Send` <-> SDK `Send` mapping. These verify the mapping is
 * lossless and self-consistent (enum-likes, dates, emails, nested text/file, EncString
 * pass-through) without invoking the WASM SDK at runtime (PM-31068 / PM-39432).
 */
describe("Send <-> SDK Send mapping", () => {
  function textSendData(): SendData {
    const data = new SendData();
    data.id = "00000000-0000-0000-0000-000000000001";
    data.accessId = "access-id-1";
    data.type = SendType.Text;
    data.authType = AuthType.None;
    data.name = "2.name-iv|name-data|name-mac";
    data.notes = "2.notes-iv|notes-data|notes-mac";
    data.key = "2.key-iv|key-data|key-mac";
    data.maxAccessCount = 5;
    data.accessCount = 2;
    data.revisionDate = "2026-01-01T00:00:00.000Z";
    data.deletionDate = "2026-02-01T00:00:00.000Z";
    data.expirationDate = "2026-01-15T00:00:00.000Z";
    data.password = "pbkdf2-derived-keyB64";
    data.emails = "a@example.com,b@example.com";
    data.disabled = false;
    data.hideEmail = true;
    data.text = Object.assign(new SendTextData(), {
      text: "2.text-iv|text-data|text-mac",
      hidden: true,
    });
    return data;
  }

  function fileSendData(): SendData {
    const data = new SendData();
    data.id = "00000000-0000-0000-0000-000000000002";
    data.accessId = "access-id-2";
    data.type = SendType.File;
    data.authType = AuthType.Email;
    data.name = "2.fname-iv|fname-data|fname-mac";
    data.notes = null;
    data.key = "2.fkey-iv|fkey-data|fkey-mac";
    data.maxAccessCount = undefined;
    data.accessCount = 0;
    data.revisionDate = "2026-03-01T00:00:00.000Z";
    data.deletionDate = "2026-04-01T00:00:00.000Z";
    data.expirationDate = null;
    data.password = null;
    data.emails = "only@example.com";
    data.disabled = true;
    data.hideEmail = false;
    data.file = Object.assign(new SendFileData(), {
      id: "file-id",
      fileName: "2.file-iv|file-data|file-mac",
      size: "1024",
      sizeName: "1 KB",
    });
    return data;
  }

  describe("toSdkSend", () => {
    it("maps a text send, translating enum-likes, dates, and emails", () => {
      const send = new Send(textSendData());

      const sdk = send.toSdkSend();

      expect(sdk.id).toBe("00000000-0000-0000-0000-000000000001");
      expect(sdk.accessId).toBe("access-id-1");
      expect(sdk.type).toBe(SdkSendType.Text);
      expect(sdk.authType).toBe(SdkAuthType.None);
      expect(sdk.name).toBe("2.name-iv|name-data|name-mac");
      expect(sdk.notes).toBe("2.notes-iv|notes-data|notes-mac");
      expect(sdk.key).toBe("2.key-iv|key-data|key-mac");
      expect(sdk.maxAccessCount).toBe(5);
      expect(sdk.accessCount).toBe(2);
      expect(sdk.disabled).toBe(false);
      expect(sdk.hideEmail).toBe(true);
      expect(sdk.revisionDate).toBe("2026-01-01T00:00:00.000Z");
      expect(sdk.deletionDate).toBe("2026-02-01T00:00:00.000Z");
      expect(sdk.expirationDate).toBe("2026-01-15T00:00:00.000Z");
      expect(sdk.emails).toBe("a@example.com,b@example.com");
      expect(sdk.password).toBe("pbkdf2-derived-keyB64");
      expect(sdk.text).toEqual({ text: "2.text-iv|text-data|text-mac", hidden: true });
      expect(sdk.file).toBeUndefined();
    });

    it("maps a file send, omitting null optionals", () => {
      const send = new Send(fileSendData());

      const sdk = send.toSdkSend();

      expect(sdk.type).toBe(SdkSendType.File);
      expect(sdk.authType).toBe(SdkAuthType.Email);
      expect(sdk.notes).toBeUndefined();
      expect(sdk.maxAccessCount).toBeUndefined();
      expect(sdk.expirationDate).toBeUndefined();
      expect(sdk.password).toBeUndefined();
      expect(sdk.text).toBeUndefined();
      expect(sdk.file).toEqual({
        id: "file-id",
        fileName: "2.file-iv|file-data|file-mac",
        size: "1024",
        sizeName: "1 KB",
      });
    });
  });

  describe("round-trip toSdkSend -> fromSdkSend", () => {
    it.each([
      ["text", textSendData],
      ["file", fileSendData],
    ])("preserves all fields for a %s send", (_label, build) => {
      const original = new Send(build());

      const back = Send.fromSdkSend(original.toSdkSend());

      expect(back.id).toBe(original.id);
      expect(back.accessId).toBe(original.accessId);
      expect(back.type).toBe(original.type);
      expect(back.authType).toBe(original.authType);
      expect(back.name?.toSdk()).toBe(original.name?.toSdk());
      expect(back.notes?.toSdk()).toBe(original.notes?.toSdk());
      expect(back.key?.toSdk()).toBe(original.key?.toSdk());
      expect(back.password).toBe(original.password);
      expect(back.maxAccessCount).toBe(original.maxAccessCount);
      expect(back.accessCount).toBe(original.accessCount);
      expect(back.disabled).toBe(original.disabled);
      expect(back.hideEmail).toBe(original.hideEmail);
      expect(back.emails).toBe(original.emails);
      expect(back.revisionDate).toEqual(original.revisionDate);
      expect(back.deletionDate).toEqual(original.deletionDate);
      expect(back.expirationDate).toEqual(original.expirationDate);
      expect(back.text?.text?.toSdk()).toBe(original.text?.text?.toSdk());
      expect(back.text?.hidden).toBe(original.text?.hidden);
      expect(back.file?.fileName?.toSdk()).toBe(original.file?.fileName?.toSdk());
      expect(back.file?.id).toBe(original.file?.id);
      expect(back.file?.size).toBe(original.file?.size);
      expect(back.file?.sizeName).toBe(original.file?.sizeName);
    });
  });

  describe("SendRecordMapper round-trip (SendData <-> SDK)", () => {
    const mapper = new SendRecordMapper();

    it("points at the SEND_USER_ENCRYPTED state", () => {
      expect(mapper.userKeyDefinition().key).toBe("sendUserEncrypted");
    });

    it.each([
      ["text", textSendData],
      ["file", fileSendData],
    ])("preserves SendData through toSdk -> fromSdk for a %s send", (_label, build) => {
      const data = build();

      const back = mapper.fromSdk(mapper.toSdk(data));

      expect(back).toEqual(data);
    });
  });
});
