import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { makeSymmetricCryptoKey, mockContainerService, mockEnc } from "../../../../../spec";
import { SendType } from "../../enums/send-type";
import { SendAccessResponse } from "../response/send-access.response";

import { SendAccess } from "./send-access";
import { SendText } from "./send-text";

describe("SendAccess", () => {
  let request: SendAccessResponse;

  beforeEach(() => {
    request = {
      id: "id",
      type: SendType.Text,
      name: "encName",
      file: null,
      text: {
        text: "encText",
        hidden: true,
      },
      expirationDate: new Date("2022-01-31T12:00:00.000Z"),
      creatorIdentifier: "creatorIdentifier",
    } as SendAccessResponse;
  });

  it("Convert from empty", () => {
    const request = new SendAccessResponse({});
    const sendAccess = new SendAccess(request);

    expect(sendAccess).toEqual({
      id: null,
      type: undefined,
      name: null,
      creatorIdentifier: null,
      expirationDate: null,
    });
  });

  it("Convert", () => {
    const sendAccess = new SendAccess(request);

    expect(sendAccess).toEqual({
      id: "id",
      type: 0,
      name: { encryptedString: "encName", encryptionType: 0 },
      text: {
        hidden: true,
        text: { encryptedString: "encText", encryptionType: 0 },
      },
      expirationDate: new Date("2022-01-31T12:00:00.000Z"),
      creatorIdentifier: "creatorIdentifier",
    });
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService.getKeyService().userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64)));
    containerService.getEncryptService().decryptString.mockResolvedValue("name");

    const sendAccess = new SendAccess();
    sendAccess.id = "id";
    sendAccess.type = SendType.Text;
    sendAccess.name = mockEnc("name");

    const text = mock<SendText>();
    text.decrypt.mockResolvedValue({} as any);
    sendAccess.text = text;

    sendAccess.expirationDate = new Date("2022-01-31T12:00:00.000Z");
    sendAccess.creatorIdentifier = "creatorIdentifier";

    const view = await sendAccess.decrypt(null);

    expect(text.decrypt).toHaveBeenCalledTimes(1);

    expect(view).toEqual({
      id: "id",
      type: 0,
      name: "name",
      text: {},
      file: expect.anything(),
      expirationDate: new Date("2022-01-31T12:00:00.000Z"),
      creatorIdentifier: "creatorIdentifier",
    });
  });
});
