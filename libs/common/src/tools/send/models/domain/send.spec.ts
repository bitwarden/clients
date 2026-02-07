import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { emptyGuid, UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { makeStaticByteArray, mockContainerService, mockEnc } from "../../../../../spec";
import { EncryptService } from "../../../../key-management/crypto/abstractions/encrypt.service";
import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "../../../../platform/services/container.service";
import { UserKey } from "../../../../types/key";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import { SendData } from "../data/send.data";

import { SendText } from "./send-text";

describe("Send", () => {
  let data: SendData;

  beforeEach(() => {
    data = {
      id: "id",
      accessId: "accessId",
      type: SendType.Text,
      name: "encName",
      notes: "encNotes",
      text: {
        text: "encText",
        hidden: true,
      },
      file: null!,
      key: "encKey",
      maxAccessCount: null!,
      accessCount: 10,
      revisionDate: "2022-01-31T12:00:00.000Z",
      expirationDate: "2022-01-31T12:00:00.000Z",
      deletionDate: "2022-01-31T12:00:00.000Z",
      password: "password",
      emails: "",
      disabled: false,
      hideEmail: true,
      authType: AuthType.None,
    };

    mockContainerService();
  });

  it("Convert from empty", () => {
    const data = new SendData();
    const send = new Send(data);

    expect(send).toEqual({
      id: null,
      accessId: null,
      type: undefined,
      authType: undefined,
      name: null,
      notes: null,
      text: undefined,
      file: undefined,
      key: null,
      maxAccessCount: undefined,
      accessCount: undefined,
      revisionDate: null,
      expirationDate: null,
      deletionDate: null,
      password: undefined,
      emails: undefined,
      disabled: undefined,
      hideEmail: undefined,
    });
  });

  it("Convert", () => {
    const send = new Send(data);

    expect(send).toEqual({
      id: "id",
      accessId: "accessId",
      type: SendType.Text,
      name: { encryptedString: "encName", encryptionType: 0 },
      notes: { encryptedString: "encNotes", encryptionType: 0 },
      text: {
        text: { encryptedString: "encText", encryptionType: 0 },
        hidden: true,
      },
      key: { encryptedString: "encKey", encryptionType: 0 },
      maxAccessCount: null,
      accessCount: 10,
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
      expirationDate: new Date("2022-01-31T12:00:00.000Z"),
      deletionDate: new Date("2022-01-31T12:00:00.000Z"),
      password: "password",
      emails: "",
      disabled: false,
      hideEmail: true,
      authType: AuthType.None,
    });
  });

  it("Decrypt", async () => {
    const text = mock<SendText>();
    text.decrypt.mockResolvedValue("textView" as any);
    const userKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const userId = emptyGuid as UserId;

    const send = new Send();
    send.id = "id";
    send.accessId = "accessId";
    send.type = SendType.Text;
    send.authType = AuthType.None;
    send.name = mockEnc("name");
    send.notes = mockEnc("notes");
    send.text = text;
    send.key = mockEnc("key");
    send.accessCount = 10;
    send.revisionDate = new Date("2022-01-31T12:00:00.000Z");
    send.expirationDate = new Date("2022-01-31T12:00:00.000Z");
    send.deletionDate = new Date("2022-01-31T12:00:00.000Z");
    send.password = "password";
    send.emails = null;
    send.disabled = false;
    send.hideEmail = true;
    send.authType = AuthType.None;

    const encryptService = mock<EncryptService>();
    const keyService = mock<KeyService>();
    encryptService.decryptBytes
      .calledWith(send.key, userKey)
      .mockResolvedValue(makeStaticByteArray(32));
    encryptService.decryptString
      .calledWith(send.name, "cryptoKey" as any)
      .mockResolvedValue("name");
    encryptService.decryptString
      .calledWith(send.notes, "cryptoKey" as any)
      .mockResolvedValue("notes");
    keyService.makeSendKey.mockResolvedValue("cryptoKey" as any);
    keyService.userKey$.calledWith(userId).mockReturnValue(of(userKey));

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    const view = await send.decrypt(userId);

    expect(text.decrypt).toHaveBeenNthCalledWith(1, "cryptoKey");

    expect(view).toMatchObject({
      id: "id",
      accessId: "accessId",
      name: "name",
      notes: "notes",
      type: 0,
      key: expect.anything(),
      cryptoKey: "cryptoKey",
      file: expect.anything(),
      text: "textView",
      maxAccessCount: undefined,
      accessCount: 10,
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
      expirationDate: new Date("2022-01-31T12:00:00.000Z"),
      deletionDate: new Date("2022-01-31T12:00:00.000Z"),
      password: "password",
      emails: [],
      disabled: false,
      hideEmail: true,
      authType: AuthType.None,
    });
  });

  describe("Email parsing", () => {
    let encryptService: jest.Mocked<EncryptService>;
    let keyService: jest.Mocked<KeyService>;
    const userKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const userId = emptyGuid as UserId;

    beforeEach(() => {
      encryptService = mock<EncryptService>();
      keyService = mock<KeyService>();
      encryptService.decryptBytes.mockResolvedValue(makeStaticByteArray(32));
      keyService.makeSendKey.mockResolvedValue("cryptoKey" as any);
      keyService.userKey$.mockReturnValue(of(userKey));
      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);
    });

    it("should parse single email", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = "test@example.com";
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);
      const view = await send.decrypt(userId);
      expect(view.emails).toEqual(["test@example.com"]);
    });

    it("should parse multiple emails", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = "test@example.com,user@test.com,admin@domain.com";
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);
      const view = await send.decrypt(userId);
      expect(view.emails).toEqual(["test@example.com", "user@test.com", "admin@domain.com"]);
    });

    it("should trim whitespace from emails", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = "  test@example.com  ,  user@test.com  ";
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);
      const view = await send.decrypt(userId);
      expect(view.emails).toEqual(["test@example.com", "user@test.com"]);
    });

    it("should return empty array when emails is null", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = null;
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);

      const view = await send.decrypt(userId);

      expect(view.emails).toEqual([]);
      expect(encryptService.decryptString).not.toHaveBeenCalledWith(expect.anything(), "cryptoKey");
    });

    it("should return empty array when emails is empty string", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = "";
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);
      const view = await send.decrypt(userId);
      expect(view.emails).toEqual([]);
    });
  });

  describe("Null handling for name and notes decryption", () => {
    let encryptService: jest.Mocked<EncryptService>;
    let keyService: jest.Mocked<KeyService>;
    const userKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const userId = emptyGuid as UserId;

    beforeEach(() => {
      encryptService = mock<EncryptService>();
      keyService = mock<KeyService>();
      encryptService.decryptBytes.mockResolvedValue(makeStaticByteArray(32));
      keyService.makeSendKey.mockResolvedValue("cryptoKey" as any);
      keyService.userKey$.mockReturnValue(of(userKey));
      (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);
    });

    it("should return null for name when name is null", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = null;
      send.notes = mockEnc("notes");
      send.key = mockEnc("key");
      send.emails = null;
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);

      const view = await send.decrypt(userId);

      expect(view.name).toBeNull();
      expect(encryptService.decryptString).not.toHaveBeenCalledWith(null, expect.anything());
    });

    it("should return null for notes when notes is null", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("name");
      send.notes = null;
      send.key = mockEnc("key");
      send.emails = null;
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);

      const view = await send.decrypt(userId);

      expect(view.notes).toBeNull();
    });

    it("should decrypt non-null name and notes", async () => {
      const send = new Send();
      send.id = "id";
      send.type = SendType.Text;
      send.name = mockEnc("Test Name");
      send.notes = mockEnc("Test Notes");
      send.key = mockEnc("key");
      send.emails = null;
      send.text = mock<SendText>();
      send.text.decrypt = jest.fn().mockResolvedValue("textView" as any);

      encryptService.decryptString.mockImplementation((encString, key) => {
        if (encString === send.name) {
          return Promise.resolve("Test Name");
        }
        if (encString === send.notes) {
          return Promise.resolve("Test Notes");
        }
        return Promise.resolve("");
      });

      const view = await send.decrypt(userId);

      expect(view.name).toBe("Test Name");
      expect(view.notes).toBe("Test Notes");
    });
  });
});
