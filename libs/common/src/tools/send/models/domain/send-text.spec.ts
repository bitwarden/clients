import { of } from "rxjs";

import { makeSymmetricCryptoKey, mockContainerService, mockEnc } from "../../../../../spec";
import { SendTextData } from "../data/send-text.data";

import { SendText } from "./send-text";

describe("SendText", () => {
  let data: SendTextData;

  beforeEach(() => {
    data = {
      text: "encText",
      hidden: false,
    };
  });

  it("Convert from empty", () => {
    const data = new SendTextData();
    const secureNote = new SendText(data);

    expect(secureNote).toEqual({
      hidden: undefined,
      text: null,
    });
  });

  it("Convert", () => {
    const secureNote = new SendText(data);

    expect(secureNote).toEqual({
      hidden: false,
      text: { encryptedString: "encText", encryptionType: 0 },
    });
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService.getKeyService().userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64)));
    containerService.getEncryptService().decryptString.mockResolvedValue("text");

    const sendText = new SendText();
    sendText.text = mockEnc("text");
    sendText.hidden = true;

    const view = await sendText.decrypt(null);

    expect(view).toEqual({
      text: "text",
      hidden: true,
    });
  });
});
