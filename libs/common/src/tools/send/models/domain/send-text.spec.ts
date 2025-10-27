import { of } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import mock from "@bitwarden/common/platform/spec/mock-deep";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

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
    containerService.getEncryptService()
      .decryptString.mockResolvedValue("text");

    const secureNote = new SendText();
    secureNote.text = mockEnc("text");
    secureNote.hidden = true;

    const view = await secureNote.decrypt(null, null);

    expect(view).toEqual({
      text: "text",
      hidden: true,
    });
  });
});
