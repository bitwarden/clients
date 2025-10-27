import { of } from "rxjs";

import mock from "@bitwarden/common/platform/spec/mock-deep";
import { emptyGuid, UserId } from "@bitwarden/common/types/guid";

import {
  mockEnc,
  makeStaticByteArray,
  mockContainerService,
  makeSymmetricCryptoKey,
} from "../../../../../spec";
import { SendType } from "../../enums/send-type";
import { SendData } from "../data/send.data";

import { Send } from "./send";
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
      emails: null!,
      disabled: false,
      hideEmail: true,
    };
  });

  it("Convert from empty", () => {
    const data = new SendData();
    const send = new Send(data);

    expect(send).toEqual({
      id: null,
      accessId: null,
      type: undefined,
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
      emails: null!,
      disabled: false,
      hideEmail: true,
    });
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService.getKeyService().userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64)));
    containerService
      .getEncryptService()
      .decryptString.mockResolvedValueOnce("name")
      .mockResolvedValueOnce("notes");
    containerService
      .getEncryptService()
      .decryptBytes.mockResolvedValueOnce(makeStaticByteArray(32));

    const text = mock<SendText>();
    text.decrypt.mockResolvedValue("textView" as any);
    const userId = emptyGuid as UserId;

    const send = new Send();
    send.id = "id";
    send.accessId = "accessId";
    send.type = SendType.Text;
    send.name = mockEnc("name");
    send.notes = mockEnc("notes");
    send.text = text;
    send.key = mockEnc("key");
    send.accessCount = 10;
    send.revisionDate = new Date("2022-01-31T12:00:00.000Z");
    send.expirationDate = new Date("2022-01-31T12:00:00.000Z");
    send.deletionDate = new Date("2022-01-31T12:00:00.000Z");
    send.password = "password";
    send.disabled = false;
    send.hideEmail = true;

    containerService.getKeyService().makeSendKey.mockResolvedValue("cryptoKey" as any);

    const view = await send.decrypt(userId);

    expect(text.decrypt).toHaveBeenNthCalledWith(1, userId, "cryptoKey");

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
      disabled: false,
      hideEmail: true,
    });
  });
});
