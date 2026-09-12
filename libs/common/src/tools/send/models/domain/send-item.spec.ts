import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { mockContainerService } from "../../../../../spec";
import { Cipher } from "../../../../vault/models/domain/cipher";
import { SendItemData } from "../data/send-item.data";

import { SendItem } from "./send-item";

describe("SendItem", () => {
  let data: SendItemData;

  beforeEach(() => {
    const cipher = new Cipher();
    cipher.id = "test-cipher";
    data = {
      data: JSON.stringify(cipher),
      encryptionVersion: SendEncryptionType.V1,
    };

    mockContainerService();
  });

  it("Convert", () => {
    const sendItem = new SendItem(data);

    expect(sendItem).toEqual({
      encryptionVersion: SendEncryptionType.V1,
      data: expect.objectContaining({
        id: expect.stringMatching("test-cipher"),
      }),
    });
  });
});
